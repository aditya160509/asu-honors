
class MobilePhone:
    def __init__(self, brand, model, battery_level):
        self.brand = brand
        self.model = model
        self.battery_level = battery_level

    def use_battery(self, amount):
        if amount < 0:
            print("Amount to use cannot be negative.")
            return
        if self.battery_level - amount < 0:
            print("Battery level cannot go below 0%.")
            self.battery_level = 0
        else:
            self.battery_level -= amount

    def charge(self, amount):
        if amount < 0:
            print("Amount to charge cannot be negative.")
            return
        if self.battery_level + amount > 100:
            print("Battery level cannot exceed 100%.")
            self.battery_level = 100
        else:
            self.battery_level += amount

    def display_battery(self):
        return self.battery_level


# Create phone and test
mobile1 = MobilePhone("Samsung", "Galaxy S21", 50)
mobile1.use_battery(20)
mobile1.charge(10)
print("Battery level is:", mobile1.display_battery())