# -*- coding: utf-8 -*-
from pathlib import Path
path = Path('server/routes.ts')
text = path.read_text()
needle = "const defaultItemCategories = ["
start = text.index(needle)
end = text.index("\n];", start)
entries = [
    ("Fresh Produce", "??", "Locally sourced fruits and vegetables."),
    ("Dairy & Eggs", "??", "Cheese, yogurt, milk, and eggs."),
    ("Bakery", "??", "Bread, pastries, and baked treats."),
    ("Butcher & Meat", "??", "Fresh cuts of meat and poultry."),
    ("Seafood", "??", "Fish, shellfish, and ocean catches."),
    ("Pantry Staples", "??", "Rice, flour, grains, and dry goods."),
    ("Frozen Foods", "??", "Frozen veggies, entrees, and desserts."),
    ("Beverages", "??", "Juices, sodas, teas, and hydration."),
    ("Snacks", "??", "Chips, nuts, popcorn, and treats."),
    ("Ready Meals", "??", "Prepared meals for quick reheating."),
    ("Organic Goods", "??", "Certified organic groceries and goods."),
    ("Health & Supplements", "??", "Vitamins, supplements, and wellness boosters."),
    ("Personal Care", "??", "Skincare, haircare, and hygiene products."),
    ("Cleaning Supplies", "??", "Household cleaners, wipes, and tools."),
    ("Home Decor", "???", "Decorative accents and home pieces."),
    ("Stationery", "??", "Pens, notebooks, and office essentials."),
    ("Electronics", "??", "Gadgets, monitors, and accessories."),
    ("Mobile Accessories", "??", "Chargers, cases, and mobile gear."),
    ("Toys & Games", "??", "Toys, puzzles, and board games."),
    ("Baby Essentials", "??", "Baby care, diapers, and feeding supplies."),
    ("Pet Supplies", "??", "Food, grooming, and pet toys."),
    ("Garden & Outdoor", "??", "Gardening kits, seeds, and outdoor goods."),
    ("Tools & Hardware", "???", "Hand tools, repairs, and hardware bits."),
    ("Building Materials", "??", "Concrete, lumber, and construction supplies."),
    ("Automotive", "??", "Car care, oils, and vehicle parts."),
    ("Fitness Gear", "???", "Workout equipment and activewear."),
    ("Apparel", "??", "Clothing for men, women, and children."),
    ("Footwear", "??", "Casual, formal, and sports shoes."),
    ("Accessories", "??", "Bags, belts, hats, and fashion extras."),
    ("Jewelry", "??", "Rings, necklaces, and sparkly pieces."),
    ("Sustainable Goods", "??", "Eco-friendly and zero-waste items."),
    ("Art Supplies", "??", "Paints, brushes, and creative gear."),
    ("Books & Media", "??", "Books, magazines, and media kits."),
    ("Music & Instruments", "??", "Instruments, speakers, and audio tools."),
    ("Gifts & Crafts", "??", "Crafts, gift sets, and curated bundles."),
    ("Party Supplies", "??", "Balloons, décor, and celebration kits."),
    ("Travel Essentials", "??", "Luggage, organizers, and travel accessories."),
    ("Home Appliances", "??", "Washers, kitchen machines, and gadgets."),
    ("Furniture", "???", "Indoor and outdoor furnishings."),
    ("Kitchenware", "???", "Cookware, bakeware, and serving pieces."),
    ("Tableware", "??", "Cutlery, plates, and dining sets."),
    ("Lighting", "??", "Lamps, bulbs, and decorative lighting."),
    ("Coffee & Tea", "?", "Beans, grounds, infusions, and mugs."),
    ("Candy & Treats", "??", "Sweets, chocolates, and confectionery."),
    ("Spices & Condiments", "??", "Spices, sauces, and seasoning blends."),
    ("Canned & Jarred", "??", "Preserves, sauces, and ready-to-eat items."),
    ("Deli & Ready-to-Eat", "??", "Deli meats, salads, and grab-and-go bites."),
    ("Breakfast & Cereal", "??", "Cereal, oats, and morning staples."),
    ("Outdoor & Camping", "???", "Tents, grills, and adventure gear."),
    ("Office Essentials", "???", "Desk organizers, folders, and office tools."),
]
new_list = "const defaultItemCategories = [\n"
new_list += "\n".join(f"  {{ name: \"{name}\", emoji: \"{emoji}\", description: \"{desc}\" }}," for name, emoji, desc in entries)
new_list += "\n];"
new_text = text[:start] + new_list + text[end+3:]
path.write_text(new_text)
