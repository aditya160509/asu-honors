
class Book:
    def __init__(self, title, author, price):
        self.title = title
        self.author = author
        self.price = price

    def set_price(self, newprice):
        self.price = newprice

    def get_title(self):
        return self.title

    def get_price(self):
        return self.price


book1 = Book("hello", "aditya", 100)
book1.set_price(150)

print("title is ", book1.get_title())
print("updated price is ", book1.get_price())
