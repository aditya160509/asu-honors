"""Named watchlist groups. The legacy flat /watchlist endpoints keep working by
operating on the user's default group (lowest sort_order, created on demand)."""

import logging

from sqlalchemy.orm import Session

from apps.api.exceptions import ConflictError, NotFoundError
from apps.api.schemas import WatchlistEntry, WatchlistGroupResponse
from db.models import Company, User, Watchlist, WatchlistGroup

logger = logging.getLogger(__name__)

DEFAULT_GROUP_NAME = "Default"


def get_or_create_default_group(db: Session, user: User) -> WatchlistGroup:
    group = (
        db.query(WatchlistGroup)
        .filter_by(user_id=user.id)
        .order_by(WatchlistGroup.sort_order.asc(), WatchlistGroup.id.asc())
        .first()
    )
    if group is not None:
        return group
    group = WatchlistGroup(user_id=user.id, name=DEFAULT_GROUP_NAME, sort_order=0)
    db.add(group)
    db.flush()
    return group


def _get_owned_group(db: Session, user: User, group_id: int) -> WatchlistGroup:
    group = db.query(WatchlistGroup).filter_by(id=group_id, user_id=user.id).first()
    if group is None:
        raise NotFoundError("Watchlist not found")
    return group


def _group_response(db: Session, group: WatchlistGroup) -> WatchlistGroupResponse:
    rows = (
        db.query(Watchlist)
        .filter_by(group_id=group.id)
        .order_by(Watchlist.sort_order.asc(), Watchlist.id.asc())
        .all()
    )
    company_ids = {r.company_id for r in rows}
    companies = (
        {c.id: c for c in db.query(Company).filter(Company.id.in_(company_ids)).all()}
        if company_ids
        else {}
    )
    items = [
        WatchlistEntry(
            company_id=r.company_id,
            ticker=companies[r.company_id].ticker,
            name=companies[r.company_id].name,
            sort_order=r.sort_order,
        )
        for r in rows
        if r.company_id in companies
    ]
    return WatchlistGroupResponse(id=group.id, name=group.name, sort_order=group.sort_order, items=items)


def list_groups(db: Session, user: User) -> list[WatchlistGroupResponse]:
    groups = (
        db.query(WatchlistGroup)
        .filter_by(user_id=user.id)
        .order_by(WatchlistGroup.sort_order.asc(), WatchlistGroup.id.asc())
        .all()
    )
    return [_group_response(db, g) for g in groups]


def create_group(db: Session, user: User, name: str) -> WatchlistGroupResponse:
    clean = name.strip()
    existing = db.query(WatchlistGroup).filter_by(user_id=user.id, name=clean).first()
    if existing is not None:
        raise ConflictError("A watchlist with that name already exists")
    max_order = (
        db.query(WatchlistGroup).filter_by(user_id=user.id).count()
    )
    group = WatchlistGroup(user_id=user.id, name=clean, sort_order=max_order)
    db.add(group)
    db.commit()
    return _group_response(db, group)


def rename_group(db: Session, user: User, group_id: int, name: str) -> WatchlistGroupResponse:
    group = _get_owned_group(db, user, group_id)
    clean = name.strip()
    duplicate = (
        db.query(WatchlistGroup)
        .filter(WatchlistGroup.user_id == user.id, WatchlistGroup.name == clean, WatchlistGroup.id != group_id)
        .first()
    )
    if duplicate is not None:
        raise ConflictError("A watchlist with that name already exists")
    group.name = clean
    db.commit()
    return _group_response(db, group)


def delete_group(db: Session, user: User, group_id: int) -> None:
    group = _get_owned_group(db, user, group_id)
    db.delete(group)  # rows cascade via FK
    db.commit()


def add_item(db: Session, user: User, group_id: int, company_id: int) -> WatchlistGroupResponse:
    group = _get_owned_group(db, user, group_id)
    company = db.query(Company).filter_by(id=company_id).first()
    if company is None:
        raise NotFoundError("Company not found")
    existing = db.query(Watchlist).filter_by(group_id=group.id, company_id=company_id).first()
    if existing is not None:
        raise ConflictError("Company already in this watchlist")
    next_order = db.query(Watchlist).filter_by(group_id=group.id).count()
    db.add(Watchlist(user_id=user.id, company_id=company_id, group_id=group.id, sort_order=next_order))
    db.commit()
    return _group_response(db, group)


def remove_item(db: Session, user: User, group_id: int, company_id: int) -> None:
    group = _get_owned_group(db, user, group_id)
    row = db.query(Watchlist).filter_by(group_id=group.id, company_id=company_id).first()
    if row is not None:
        db.delete(row)
        db.commit()


def reorder_items(
    db: Session, user: User, group_id: int, company_ids: list[int]
) -> WatchlistGroupResponse:
    group = _get_owned_group(db, user, group_id)
    rows = {r.company_id: r for r in db.query(Watchlist).filter_by(group_id=group.id).all()}
    order = {cid: i for i, cid in enumerate(company_ids)}
    # Unmentioned rows keep their relative order after the mentioned ones.
    tail = len(order)
    for r in sorted(rows.values(), key=lambda r: r.sort_order):
        if r.company_id in order:
            r.sort_order = order[r.company_id]
        else:
            r.sort_order = tail
            tail += 1
    db.commit()
    return _group_response(db, group)
