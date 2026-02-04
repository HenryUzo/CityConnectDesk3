import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  type FC,
  ReactNode,
} from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  adminApiRequest,
  setAdminToken,
  setCurrentEstate,
  getCurrentEstate,
} from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createMarketplaceItemSchema,
  updateMarketplaceItemSchema,
  createProviderSchema,
  type CreateMarketplaceItemInput,
  type UpdateMarketplaceItemInput,
  type CreateProviderInput,
  type IMarketplaceItem,
} from "@shared/admin-schema";
import { businessTypes } from "@/components/company/CompanyRegistrationFormFields";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmojiCombobox from "@/components/admin/EmojiCombobox";
import { Label } from "@/components/ui/label";
import DetailsView from "@/components/admin/DetailsView";
import { Textarea } from "@/components/ui/textarea";
import formatDate from "@/utils/formatDate";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArtisanRequestsPanel from "@/components/admin/ArtisanRequestsPanel";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertTriangle,
  Building2,
  Briefcase,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  DollarSign,
  Bell,
  Download,
  Edit,
  Eye,
  FileBarChart,
  Globe,
  GripVertical,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldOff,
  ShoppingBag,
  Star,
  Store,
  Tags,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

// Shopping-focused emoji palette (generated into dropdown)
const EMOJI_GROUPS = [
  { value: "ðŸŽ", names: ["Apple", "Apple Bag", "Apple Basket", "Apple Box", "Apple Jam", "Apple Juice", "Apple Pie", "Apple Snack", "Apple Crate", "Apple Pack"] },
  { value: "ðŸ", names: ["Green Apple", "Green Apple Box", "Green Apple Juice", "Green Apple Pie", "Green Apple Snack", "Green Apple Basket", "Green Apple Crate", "Green Apple Jam", "Green Apple Pack", "Green Apple Bundle"] },
  { value: "ðŸŒ", names: ["Banana", "Banana Bunch", "Banana Chips", "Banana Smoothie", "Banana Yogurt", "Banana Bread", "Banana Pack", "Banana Basket", "Banana Split", "Banana Snack"] },
  { value: "ðŸ‡", names: ["Grapes", "Grape Box", "Grape Juice", "Grape Jam", "Grape Pack", "Grape Snack", "Grape Basket", "Grape Bundle", "Grape Carton", "Grape Tray"] },
  { value: "ðŸ“", names: ["Strawberry", "Strawberry Box", "Strawberry Jam", "Strawberry Yogurt", "Strawberry Milk", "Strawberry Cake", "Strawberry Pack", "Strawberry Basket", "Strawberry Snack", "Strawberry Tart"] },
  { value: "ðŸ’", names: ["Cherry", "Cherry Box", "Cherry Jam", "Cherry Juice", "Cherry Pack", "Cherry Basket", "Cherry Tart", "Cherry Snack", "Cherry Mix", "Cherry Crate"] },
  { value: "ðŸ‘", names: ["Peach", "Peach Jam", "Peach Juice", "Peach Tart", "Peach Basket", "Peach Crate", "Peach Yogurt", "Peach Pack", "Peach Snack", "Peach Slices"] },
  { value: "ðŸ", names: ["Pineapple", "Pineapple Slices", "Pineapple Juice", "Pineapple Rings", "Pineapple Jam", "Pineapple Pack", "Pineapple Snack", "Pineapple Basket", "Pineapple Chunks", "Pineapple Crate"] },
  { value: "ðŸ¥­", names: ["Mango", "Mango Juice", "Mango Slices", "Mango Jam", "Mango Lassi", "Mango Pack", "Mango Basket", "Mango Snack", "Mango Chutney", "Mango Crate"] },
  { value: "ðŸ‰", names: ["Watermelon", "Watermelon Slice", "Watermelon Juice", "Watermelon Pack", "Watermelon Snack", "Watermelon Basket", "Watermelon Wedges", "Watermelon Crate", "Watermelon Bowl", "Watermelon Platter"] },
  { value: "ðŸ¥", names: ["Kiwi", "Kiwi Pack", "Kiwi Slices", "Kiwi Yogurt", "Kiwi Juice", "Kiwi Basket", "Kiwi Snack", "Kiwi Crate", "Kiwi Mix", "Kiwi Platter"] },
  { value: "ðŸŠ", names: ["Orange", "Orange Juice", "Orange Pack", "Orange Basket", "Orange Crate", "Orange Marmalade", "Orange Snack", "Orange Segments", "Orange Carton", "Orange Mix"] },
  { value: "ðŸ‹", names: ["Lemon", "Lemonade", "Lemon Pack", "Lemon Basket", "Lemon Crate", "Lemon Wedges", "Lemon Pie", "Lemon Tart", "Lemon Snack", "Lemon Mix"] },
  { value: "ðŸˆ", names: ["Melon", "Melon Wedges", "Melon Pack", "Melon Basket", "Melon Crate", "Melon Juice", "Melon Snack", "Melon Platter", "Melon Mix", "Melon Slices"] },
  { value: "ðŸ", names: ["Pear", "Pear Pack", "Pear Basket", "Pear Crate", "Pear Juice", "Pear Snack", "Pear Slices", "Pear Tart", "Pear Mix", "Pear Bowl"] },
  { value: "ðŸ†", names: ["Eggplant", "Eggplant Pack", "Eggplant Basket", "Eggplant Crate", "Eggplant Cutlets", "Eggplant Parm", "Eggplant Mix", "Eggplant Grill", "Eggplant Tray", "Eggplant Dip"] },
  { value: "ðŸ¥‘", names: ["Avocado", "Avocado Pack", "Avocado Basket", "Avocado Toast", "Avocado Dip", "Avocado Mix", "Avocado Crate", "Avocado Salad", "Avocado Sushi", "Avocado Bowl"] },
  { value: "ðŸŒ½", names: ["Corn", "Corn on Cob", "Corn Pack", "Corn Basket", "Corn Crate", "Corn Chips", "Corn Meal", "Corn Mix", "Corn Snack", "Corn Tray"] },
  { value: "ðŸ¥•", names: ["Carrot", "Carrot Pack", "Carrot Basket", "Carrot Crate", "Carrot Juice", "Carrot Snack", "Carrot Sticks", "Carrot Cake", "Carrot Mix", "Carrot Tray"] },
  { value: "ðŸ¥”", names: ["Potato", "Potato Bag", "Potato Pack", "Potato Basket", "Potato Crate", "Potato Wedges", "Potato Chips", "Potato Mash", "Potato Mix", "Potato Tray"] },
  { value: "ðŸ¥¦", names: ["Broccoli", "Broccoli Pack", "Broccoli Basket", "Broccoli Crate", "Broccoli Florets", "Broccoli Mix", "Broccoli Snack", "Broccoli Tray", "Broccoli Salad", "Broccoli Stir Fry"] },
  { value: "ðŸ¥¬", names: ["Lettuce", "Lettuce Pack", "Lettuce Basket", "Lettuce Crate", "Lettuce Mix", "Lettuce Heads", "Lettuce Wraps", "Lettuce Salad", "Lettuce Tray", "Lettuce Stack"] },
  { value: "ðŸ…", names: ["Tomato", "Tomato Pack", "Tomato Basket", "Tomato Crate", "Tomato Sauce", "Tomato Puree", "Tomato Soup", "Tomato Mix", "Tomato Snack", "Tomato Tray"] },
  { value: "ðŸ§„", names: ["Garlic", "Garlic Pack", "Garlic Basket", "Garlic Crate", "Garlic Paste", "Garlic Powder", "Garlic Mix", "Garlic Snack", "Garlic Tray", "Garlic Bulbs"] },
  { value: "ðŸ§…", names: ["Onion", "Onion Pack", "Onion Basket", "Onion Crate", "Onion Rings", "Onion Powder", "Onion Mix", "Onion Snack", "Onion Tray", "Onion Bulbs"] },
  { value: "ðŸŒ¶ï¸", names: ["Chili Pepper", "Chili Pack", "Chili Basket", "Chili Crate", "Chili Flakes", "Chili Powder", "Chili Mix", "Chili Snack", "Chili Tray", "Chili Sauce"] },
  { value: "ðŸ„", names: ["Mushroom", "Mushroom Pack", "Mushroom Basket", "Mushroom Crate", "Mushroom Mix", "Mushroom Snack", "Mushroom Soup", "Mushroom Tray", "Mushroom Slices", "Mushroom Skewers"] },
  { value: "ðŸ¥", names: ["Croissant", "Croissant Pack", "Croissant Basket", "Croissant Crate", "Chocolate Croissant", "Almond Croissant", "Butter Croissant", "Mini Croissant", "Croissant Tray", "Croissant Snack"] },
  { value: "ðŸž", names: ["Bread Loaf", "Bread Pack", "Bread Basket", "Bread Crate", "Wholegrain Bread", "Sourdough Bread", "White Bread", "Rye Bread", "Bread Rolls", "Bread Tray"] },
  { value: "ðŸ¥¯", names: ["Bagel", "Bagel Pack", "Bagel Basket", "Bagel Crate", "Sesame Bagel", "Everything Bagel", "Plain Bagel", "Cinnamon Bagel", "Bagel Tray", "Bagel Snack"] },
  { value: "ðŸ¥ž", names: ["Pancake", "Pancake Pack", "Pancake Mix", "Pancake Stack", "Pancake Syrup", "Pancake Basket", "Pancake Crate", "Pancake Tray", "Pancake Snack", "Mini Pancake"] },
  { value: "ðŸ§‡", names: ["Waffle", "Waffle Pack", "Waffle Mix", "Waffle Stack", "Waffle Syrup", "Waffle Basket", "Waffle Crate", "Waffle Tray", "Waffle Snack", "Mini Waffle"] },
  { value: "ðŸ¥–", names: ["Baguette", "Baguette Pack", "Baguette Basket", "Baguette Crate", "Garlic Baguette", "Seeded Baguette", "Classic Baguette", "Mini Baguette", "Baguette Tray", "Baguette Snack"] },
  { value: "ðŸ—", names: ["Chicken Drumstick", "Chicken Bucket", "Chicken Pack", "Chicken Basket", "Chicken Crate", "BBQ Chicken", "Spicy Chicken", "Fried Chicken", "Roast Chicken", "Chicken Tray"] },
  { value: "ðŸ¥©", names: ["Steak", "Steak Pack", "Steak Basket", "Steak Crate", "Ribeye Steak", "Sirloin Steak", "Flank Steak", "Steak Marinade", "Steak Tray", "Steak Cuts"] },
  { value: "ðŸ¥“", names: ["Bacon", "Bacon Pack", "Bacon Basket", "Bacon Crate", "Smoked Bacon", "Crispy Bacon", "Turkey Bacon", "Bacon Bits", "Bacon Tray", "Bacon Strips"] },
  { value: "ðŸ–", names: ["Meat Ribs", "Rib Rack", "BBQ Ribs", "Smoked Ribs", "Ribs Pack", "Ribs Basket", "Ribs Crate", "Ribs Tray", "Honey Ribs", "Spicy Ribs"] },
  { value: "ðŸ¤", names: ["Fried Shrimp", "Shrimp Pack", "Shrimp Basket", "Shrimp Crate", "Shrimp Cocktail", "Shrimp Tray", "Shrimp Skewers", "Shrimp Snack", "Garlic Shrimp", "Spicy Shrimp"] },
  { value: "ðŸŸ", names: ["Fish Fillet", "Fish Pack", "Fish Basket", "Fish Crate", "Salmon Fillet", "Cod Fillet", "Tilapia Fillet", "Fish Tray", "Smoked Fish", "Fish Steak"] },
  { value: "ðŸ£", names: ["Sushi Roll", "Sushi Box", "Sushi Pack", "Sushi Tray", "Salmon Sushi", "Tuna Sushi", "Veggie Sushi", "Sushi Platter", "Sushi Combo", "Nigiri Sushi"] },
  { value: "ðŸ•", names: ["Pizza Slice", "Pizza Box", "Cheese Pizza", "Pepperoni Pizza", "Veggie Pizza", "BBQ Pizza", "Pizza Combo", "Pizza Party", "Pizza Pack", "Pizza Tray"] },
  { value: "ðŸ”", names: ["Burger", "Cheeseburger", "Double Burger", "Veggie Burger", "Chicken Burger", "Burger Combo", "Burger Pack", "Burger Box", "Burger Meal", "Burger Tray"] },
  { value: "ðŸŒ­", names: ["Hotdog", "Chili Dog", "Cheese Dog", "BBQ Hotdog", "Hotdog Combo", "Hotdog Pack", "Hotdog Box", "Hotdog Meal", "Hotdog Tray", "Hotdog Snack"] },
  { value: "ðŸ¥ª", names: ["Sandwich", "Club Sandwich", "Chicken Sandwich", "Turkey Sandwich", "Veggie Sandwich", "Sandwich Box", "Sandwich Pack", "Sandwich Meal", "Sandwich Tray", "BLT Sandwich"] },
  { value: "ðŸŒ®", names: ["Taco", "Beef Taco", "Chicken Taco", "Fish Taco", "Veggie Taco", "Taco Pack", "Taco Box", "Taco Meal", "Taco Tray", "Taco Combo"] },
  { value: "ðŸŒ¯", names: ["Burrito", "Beef Burrito", "Chicken Burrito", "Veggie Burrito", "Bean Burrito", "Burrito Pack", "Burrito Box", "Burrito Meal", "Burrito Tray", "Burrito Combo"] },
  { value: "ðŸ¥™", names: ["Pita Pocket", "Falafel Pita", "Chicken Pita", "Lamb Pita", "Veggie Pita", "Pita Pack", "Pita Box", "Pita Meal", "Pita Tray", "Pita Combo"] },
  { value: "ðŸœ", names: ["Ramen Bowl", "Ramen Pack", "Ramen Box", "Spicy Ramen", "Chicken Ramen", "Veggie Ramen", "Miso Ramen", "Ramen Meal", "Ramen Tray", "Ramen Combo"] },
  { value: "ðŸ", names: ["Pasta", "Spaghetti", "Pasta Pack", "Pasta Box", "Pasta Meal", "Pasta Tray", "Pasta Combo", "Creamy Pasta", "Tomato Pasta", "Pesto Pasta"] },
  { value: "ðŸ²", names: ["Stew", "Stew Pack", "Stew Bowl", "Beef Stew", "Chicken Stew", "Veggie Stew", "Spicy Stew", "Stew Meal", "Stew Tray", "Stew Combo"] },
  { value: "ðŸ›", names: ["Curry", "Chicken Curry", "Beef Curry", "Veggie Curry", "Curry Pack", "Curry Box", "Curry Meal", "Curry Tray", "Curry Combo", "Spicy Curry"] },
  { value: "ðŸš", names: ["Rice Bowl", "Rice Pack", "Rice Bag", "Brown Rice", "Jasmine Rice", "Basmati Rice", "Sticky Rice", "Rice Box", "Rice Meal", "Rice Tray"] },
  { value: "ðŸ¥", names: ["Fish Cake", "Fish Cake Pack", "Fish Cake Box", "Fish Cake Tray", "Spicy Fish Cake", "Sesame Fish Cake", "Veggie Fish Cake", "Fish Cake Meal", "Fish Cake Snack", "Fish Cake Combo"] },
  { value: "ðŸ©", names: ["Doughnut", "Glazed Doughnut", "Chocolate Doughnut", "Sprinkle Doughnut", "Doughnut Box", "Doughnut Pack", "Doughnut Tray", "Doughnut Snack", "Filled Doughnut", "Mini Doughnut"] },
  { value: "ðŸª", names: ["Cookie", "Chocolate Chip Cookie", "Oatmeal Cookie", "Sugar Cookie", "Cookie Box", "Cookie Pack", "Cookie Tray", "Cookie Snack", "Cookie Gift", "Cookie Tin"] },
  { value: "ðŸ«", names: ["Chocolate Bar", "Dark Chocolate", "Milk Chocolate", "White Chocolate", "Chocolate Pack", "Chocolate Box", "Chocolate Gift", "Chocolate Snack", "Chocolate Mix", "Chocolate Tray"] },
  { value: "ðŸ¿", names: ["Popcorn", "Butter Popcorn", "Caramel Popcorn", "Cheese Popcorn", "Popcorn Tub", "Popcorn Pack", "Popcorn Box", "Popcorn Snack", "Popcorn Bowl", "Popcorn Mix"] },
  { value: "ðŸ§ƒ", names: ["Juice Box", "Apple Juice Box", "Orange Juice Box", "Grape Juice Box", "Mixed Fruit Juice", "Juice Pack", "Juice Carton", "Juice Bottle", "Juice Cooler", "Juice Case"] },
  { value: "ðŸ¥¤", names: ["Soft Drink", "Soda Can", "Soda Bottle", "Cola Can", "Lemon Soda", "Orange Soda", "Ginger Soda", "Soda Pack", "Soda Crate", "Soda Mix"] },
  { value: "ðŸ§‹", names: ["Bubble Tea", "Milk Tea", "Taro Bubble Tea", "Matcha Bubble Tea", "Brown Sugar Bubble Tea", "Fruit Bubble Tea", "Bubble Tea Pack", "Bubble Tea Tray", "Bubble Tea Kit", "Bubble Tea Mix"] },
  { value: "â˜•", names: ["Coffee", "Latte", "Cappuccino", "Espresso", "Mocha", "Iced Coffee", "Coffee Pack", "Coffee Beans", "Coffee Pods", "Coffee Gift"] },
  { value: "ðŸ·", names: ["Red Wine", "White Wine", "RosÃ© Wine", "Sparkling Wine", "Wine Bottle", "Wine Pack", "Wine Crate", "Wine Gift", "Wine Box", "Wine Pairing"] },
  { value: "ðŸº", names: ["Beer", "Beer Can", "Beer Bottle", "Craft Beer", "Lager Beer", "Ale Beer", "Beer Pack", "Beer Crate", "Beer Combo", "Beer Gift"] },
  { value: "ðŸ¥›", names: ["Milk Carton", "Milk Bottle", "Whole Milk", "Skim Milk", "Almond Milk", "Oat Milk", "Soy Milk", "Milk Pack", "Milk Crate", "Milk Cooler"] },
  { value: "ðŸ§€", names: ["Cheese Block", "Cheddar Cheese", "Mozzarella Cheese", "Parmesan Cheese", "Cheese Pack", "Cheese Tray", "Cheese Platter", "Cheese Snack", "Cheese Crate", "Cheese Basket"] },
  { value: "ðŸ¶", names: ["Sake Bottle", "Sake Pack", "Sake Gift", "Sake Crate", "Rice Wine", "Premium Sake", "Sparkling Sake", "Sake Set", "Sake Box", "Sake Pairing"] },
  { value: "ðŸ§´", names: ["Lotion", "Body Lotion", "Hand Lotion", "Face Cream", "Sunscreen", "Lotion Pack", "Lotion Gift", "Lotion Set", "Lotion Bottle", "Lotion Tube"] },
  { value: "ðŸ§»", names: ["Paper Towel", "Paper Roll", "Toilet Roll", "Kitchen Towel", "Paper Pack", "Paper Bulk", "Paper Value Pack", "Paper Carton", "Paper Bundle", "Paper Case"] },
  { value: "ðŸ§½", names: ["Sponge", "Cleaning Sponge", "Scrub Sponge", "Kitchen Sponge", "Bath Sponge", "Sponge Pack", "Sponge Bulk", "Sponge Set", "Sponge Value Pack", "Sponge Duo"] },
  { value: "ðŸ§¹", names: ["Broom", "Cleaning Broom", "Floor Broom", "Broom Set", "Broom With Dustpan", "Broom Pack", "Broom Value Pack", "Broom Combo", "Outdoor Broom", "Indoor Broom"] },
  { value: "ðŸ§º", names: ["Laundry Basket", "Storage Basket", "Market Basket", "Picnic Basket", "Gift Basket", "Fruit Basket", "Grocery Basket", "Home Basket", "Basket Set", "Basket Duo"] },
  { value: "ðŸ§¼", names: ["Soap Bar", "Hand Soap", "Body Soap", "Face Soap", "Soap Pack", "Soap Gift", "Soap Set", "Soap Refill", "Liquid Soap", "Foam Soap"] },
  { value: "ðŸ§¦", names: ["Socks", "Ankle Socks", "Crew Socks", "Sport Socks", "Wool Socks", "Dress Socks", "Socks Pack", "Socks Gift", "Socks Bundle", "Socks Trio"] },
  { value: "ðŸ‘•", names: ["T-Shirt", "Graphic Tee", "Basic Tee", "Sport Tee", "V-Neck Tee", "Long Sleeve Tee", "T-Shirt Pack", "T-Shirt Duo", "T-Shirt Bundle", "T-Shirt Gift"] },
  { value: "ðŸ‘–", names: ["Jeans", "Slim Jeans", "Straight Jeans", "Relaxed Jeans", "Dark Jeans", "Light Jeans", "Jeans Pack", "Jeans Duo", "Jeans Bundle", "Jeans Gift"] },
  { value: "ðŸ‘—", names: ["Dress", "Summer Dress", "Evening Dress", "Casual Dress", "Floral Dress", "Party Dress", "Dress Pack", "Dress Duo", "Dress Bundle", "Dress Gift"] },
  { value: "ðŸ‘”", names: ["Shirt", "Formal Shirt", "Oxford Shirt", "Linen Shirt", "Checked Shirt", "Striped Shirt", "Shirt Pack", "Shirt Duo", "Shirt Bundle", "Shirt Gift"] },
  { value: "ðŸ§¥", names: ["Jacket", "Denim Jacket", "Leather Jacket", "Puffer Jacket", "Blazer Jacket", "Rain Jacket", "Jacket Pack", "Jacket Duo", "Jacket Bundle", "Jacket Gift"] },
  { value: "ðŸ§¢", names: ["Cap", "Baseball Cap", "Trucker Cap", "Snapback Cap", "Dad Cap", "Sport Cap", "Cap Pack", "Cap Duo", "Cap Bundle", "Cap Gift"] },
  { value: "ðŸ‘Ÿ", names: ["Sneakers", "Running Sneakers", "Casual Sneakers", "High-Top Sneakers", "Court Sneakers", "Trail Sneakers", "Sneaker Pack", "Sneaker Duo", "Sneaker Bundle", "Sneaker Gift"] },
  { value: "ðŸ‘ ", names: ["Heels", "Stiletto Heels", "Block Heels", "Kitten Heels", "Party Heels", "Dress Heels", "Heels Pack", "Heels Duo", "Heels Bundle", "Heels Gift"] },
  { value: "ðŸ‘ž", names: ["Dress Shoes", "Oxford Shoes", "Derby Shoes", "Loafer Shoes", "Wingtip Shoes", "Leather Shoes", "Shoe Pack", "Shoe Duo", "Shoe Bundle", "Shoe Gift"] },
  { value: "ðŸŽ’", names: ["Backpack", "Travel Backpack", "School Backpack", "Laptop Backpack", "Hiking Backpack", "Mini Backpack", "Backpack Pack", "Backpack Duo", "Backpack Bundle", "Backpack Gift"] },
  { value: "ðŸ‘œ", names: ["Handbag", "Tote Bag", "Shoulder Bag", "Crossbody Bag", "Clutch Bag", "Satchel Bag", "Bag Pack", "Bag Duo", "Bag Bundle", "Bag Gift"] },
  { value: "ðŸ’", names: ["Ring", "Gold Ring", "Silver Ring", "Diamond Ring", "Engagement Ring", "Wedding Ring", "Ring Box", "Ring Gift", "Ring Pair", "Ring Set"] },
  { value: "âŒš", names: ["Watch", "Smart Watch", "Sport Watch", "Dress Watch", "Classic Watch", "Metal Watch", "Watch Box", "Watch Gift", "Watch Pair", "Watch Set"] },
  { value: "ðŸ“±", names: ["Smartphone", "Phone Case", "Phone Charger", "Phone Screen Guard", "Phone Bundle", "Phone Earbuds", "Phone Power Bank", "Phone Mount", "Phone Cable", "Phone Stand"] },
  { value: "ðŸ’»", names: ["Laptop", "Laptop Sleeve", "Laptop Stand", "Laptop Charger", "Laptop Dock", "Laptop Bundle", "Laptop Cooling Pad", "Laptop Bag", "Laptop Combo", "Laptop Kit"] },
  { value: "ðŸŽ§", names: ["Headphones", "Wireless Headphones", "Noise Canceling Headphones", "Gaming Headset", "On-Ear Headphones", "Over-Ear Headphones", "Headphone Case", "Headphone Stand", "Headphone Bundle", "Headphone Gift"] },
  { value: "ðŸ–¥ï¸", names: ["Monitor", "Gaming Monitor", "Office Monitor", "Curved Monitor", "4K Monitor", "Monitor Stand", "Monitor Arm", "Monitor Bundle", "Monitor Pair", "Monitor Gift"] },
  { value: "ðŸ“º", names: ["Television", "Smart TV", "LED TV", "OLED TV", "4K TV", "TV Wall Mount", "TV Soundbar", "TV Bundle", "TV Gift", "TV Pair"] },
  { value: "ðŸ§¸", names: ["Teddy Bear", "Stuffed Animal", "Plush Toy", "Toy Bundle", "Toy Gift", "Toy Set", "Toy Box", "Toy Basket", "Toy Pack", "Toy Plush"] },
  { value: "ðŸ“š", names: ["Books", "Novel Pack", "Cookbook", "Children Book", "Notebook Set", "Journal Pack", "Planner", "Story Book", "Workbook", "Reference Book"] },
  { value: "âœï¸", names: ["Pencil", "Pencil Pack", "Colored Pencil Set", "Mechanical Pencil", "Pencil Case", "Pencil Box", "Pencil Kit", "Pencil Duo", "Pencil Bundle", "Pencil Gift"] },
  { value: "ðŸ–Šï¸", names: ["Pen", "Gel Pen", "Ballpoint Pen", "Fountain Pen", "Pen Pack", "Pen Case", "Pen Box", "Pen Set", "Pen Duo", "Pen Gift"] },
  { value: "ðŸ“’", names: ["Notebook", "Spiral Notebook", "Hardcover Notebook", "Softcover Notebook", "Notebook Pack", "Notebook Bundle", "Notebook Set", "Notebook Gift", "Notebook Duo", "Notebook Trio"] },
  { value: "ðŸ§´", names: ["Shampoo", "Conditioner", "Body Wash", "Face Wash", "Hair Serum", "Body Lotion", "Hand Cream", "Hair Oil", "Shower Gel", "Self Care Kit"] },
  { value: "ðŸ§¹", names: ["Cleaning Mop", "Cleaning Kit", "Cleaning Spray", "Cleaning Cloths", "Cleaning Bucket", "Cleaning Gloves", "Cleaning Set", "Cleaning Bundle", "Cleaning Wipes", "Cleaning Pads"] },
  { value: "ðŸ§º", names: ["Laundry Hamper", "Laundry Bag", "Laundry Basket", "Laundry Detergent", "Laundry Softener", "Laundry Pods", "Laundry Sheets", "Laundry Bundle", "Laundry Kit", "Laundry Pair"] },
  { value: "ðŸ§Š", names: ["Ice Tray", "Ice Pack", "Ice Cube", "Ice Bag", "Ice Bucket", "Ice Maker", "Ice Scoop", "Ice Stones", "Ice Set", "Ice Bundle"] },
  { value: "ðŸ›ï¸", names: ["Bed", "Bed Sheet", "Bed Set", "Duvet", "Comforter", "Pillow", "Pillow Cases", "Mattress Topper", "Bed Blanket", "Bed Throw"] },
  { value: "ðŸ›‹ï¸", names: ["Sofa", "Sofa Cover", "Throw Pillow", "Cushion", "Sofa Set", "Sectional Sofa", "Loveseat", "Recliner Sofa", "Sofa Blanket", "Sofa Protector"] },
  { value: "ðŸª‘", names: ["Chair", "Dining Chair", "Office Chair", "Desk Chair", "Bar Stool", "Folding Chair", "Patio Chair", "Gaming Chair", "Accent Chair", "Chair Cushion"] },
  { value: "ðŸ½ï¸", names: ["Dinner Set", "Plate Set", "Bowl Set", "Cutlery Set", "Glass Set", "Mug Set", "Serving Tray", "Serving Bowl", "Kitchen Utensils", "Table Napkins"] },
  { value: "ðŸ”ª", names: ["Kitchen Knife", "Chef Knife", "Knife Set", "Cutting Board", "Knife Sharpener", "Knife Block", "Paring Knife", "Bread Knife", "Utility Knife", "Knife Bundle"] },
  { value: "ðŸ³", names: ["Frying Pan", "Nonstick Pan", "Skillet", "SautÃ© Pan", "Omelette Pan", "Griddle Pan", "Pan Set", "Pan Duo", "Pan Bundle", "Pan Gift"] },
  { value: "ðŸ¥£", names: ["Mixing Bowl", "Salad Bowl", "Soup Bowl", "Cereal Bowl", "Bowl Set", "Bowl Duo", "Bowl Bundle", "Bowl Gift", "Bowl Pack", "Serving Bowl"] },
  { value: "ðŸ§‚", names: ["Salt Shaker", "Pepper Grinder", "Spice Rack", "Spice Jars", "Seasoning Pack", "Herb Mix", "Spice Blend", "Salt Pack", "Pepper Pack", "Spice Kit"] },
  { value: "ðŸª¥", names: ["Toothbrush", "Toothpaste", "Oral Care Kit", "Mouthwash", "Floss", "Toothbrush Pack", "Toothbrush Duo", "Toothbrush Bundle", "Toothbrush Gift", "Toothbrush Holder"] },
  { value: "ðŸ¼", names: ["Baby Bottle", "Baby Formula", "Baby Food", "Baby Snack", "Baby Spoon", "Baby Bowl", "Baby Bib", "Baby Cup", "Baby Utensils", "Baby Sippy Cup"] },
  { value: "ðŸ§¸", names: ["Baby Plush", "Baby Toy", "Baby Rattle", "Baby Teether", "Baby Book", "Baby Blocks", "Baby Gift", "Baby Set", "Baby Bundle", "Baby Stacker"] },
  { value: "ðŸ¾", names: ["Pet Treats", "Pet Food", "Pet Toy", "Pet Leash", "Pet Collar", "Pet Bed", "Pet Bowl", "Pet Grooming", "Pet Shampoo", "Pet Bundle"] },
  { value: "âš½", names: ["Soccer Ball", "Football", "Futsal Ball", "Training Ball", "Match Ball", "Ball Pump", "Ball Net", "Ball Pack", "Ball Duo", "Ball Bundle"] },
  { value: "ðŸ€", names: ["Basketball", "Outdoor Basketball", "Indoor Basketball", "Training Basketball", "Match Basketball", "Basketball Pump", "Basketball Net", "Basketball Pack", "Basketball Duo", "Basketball Bundle"] },
  { value: "ðŸ", names: ["Volleyball", "Beach Volleyball", "Indoor Volleyball", "Training Volleyball", "Match Volleyball", "Volleyball Pump", "Volleyball Net", "Volleyball Pack", "Volleyball Duo", "Volleyball Bundle"] },
  { value: "ðŸ“", names: ["Ping Pong Paddle", "Ping Pong Balls", "Table Tennis Set", "Ping Pong Net", "Ping Pong Racket", "Ping Pong Case", "Ping Pong Pack", "Ping Pong Duo", "Ping Pong Bundle", "Ping Pong Gift"] },
  { value: "ðŸŽ¯", names: ["Dartboard", "Dart Set", "Soft Tip Darts", "Steel Tip Darts", "Dart Flights", "Dart Shafts", "Dart Case", "Dart Pack", "Dart Bundle", "Dart Gift"] },
  { value: "ðŸŽ²", names: ["Board Game", "Dice Set", "Card Game", "Puzzle", "Game Bundle", "Game Pack", "Strategy Game", "Family Game", "Party Game", "Game Gift"] },
  { value: "ðŸ“¦", names: ["Storage Box", "Gift Box", "Shipping Box", "Moving Box", "Organizer Box", "Folding Box", "Clear Box", "Decor Box", "Box Bundle", "Box Set"] },
  { value: "ðŸ›’", names: ["Shopping Cart Token", "Shopping Basket Tag", "Reusable Tote", "Market Bag", "Grocery Tote", "Foldable Tote", "Insulated Bag", "Eco Bag", "Canvas Bag", "Cart Clip"] },
  { value: "ðŸ¦Š", names: ["Fox"] },
  { value: "ðŸ¦", names: ["Lion"] },
  { value: "ðŸ¯", names: ["Tiger"] },
  { value: "ðŸ»", names: ["Bear"] },
  { value: "ðŸ¼", names: ["Panda"] },
  { value: "ðŸ¨", names: ["Koala"] },
  { value: "ðŸµ", names: ["Monkey Face"] },
  { value: "ðŸ’", names: ["Monkey"] },
  { value: "ðŸ¦‰", names: ["Owl"] },
  { value: "ðŸ§", names: ["Penguin"] },
  { value: "ðŸ¦", names: ["Bird"] },
  { value: "ðŸ¤", names: ["Baby Chick"] },
  { value: "ðŸ£", names: ["Hatching Chick"] },
  { value: "ðŸ¥", names: ["Front-Facing Baby Chick"] },
  { value: "ðŸº", names: ["Wolf"] },
  { value: "ðŸ—", names: ["Boar"] },
  { value: "ðŸ´", names: ["Horse"] },
  { value: "ðŸ¦„", names: ["Unicorn"] },
  { value: "ðŸ", names: ["Honeybee"] },
  { value: "ðŸ›", names: ["Bug"] },
  { value: "ðŸ¦‹", names: ["Butterfly"] },
  { value: "ðŸŒ", names: ["Snail"] },
  { value: "ðŸ¢", names: ["Turtle"] },
  { value: "ðŸ", names: ["Snake"] },
  { value: "ðŸ¦–", names: ["T-Rex"] },
  { value: "ðŸ¦•", names: ["Sauropod"] },
  { value: "ðŸ™", names: ["Octopus"] },
  { value: "ðŸ¦‘", names: ["Squid"] },
  { value: "ðŸ ", names: ["Tropical Fish"] },
  { value: "ðŸ³", names: ["Spouting Whale"] },
  { value: "ðŸ¬", names: ["Dolphin"] },
  { value: "ðŸ‹", names: ["Whale"] },
  { value: "ðŸŠ", names: ["Crocodile"] },
  { value: "ðŸ¦ˆ", names: ["Shark"] },
  { value: "ðŸ…", names: ["Tiger (Alt)"] },
  { value: "ðŸ¦“", names: ["Zebra"] },
  { value: "ðŸ˜", names: ["Elephant"] },
  { value: "ðŸ¦", names: ["Rhinoceros"] },
  { value: "ðŸ¦›", names: ["Hippopotamus"] },
  { value: "ðŸ«", names: ["Two-Hump Camel"] },
  { value: "ðŸª", names: ["Single-Hump Camel"] },
  { value: "ðŸ¦’", names: ["Giraffe"] },
  { value: "ðŸƒ", names: ["Water Buffalo"] },
  { value: "ðŸ‚", names: ["Ox"] },
  { value: "ðŸ„", names: ["Cow"] },
  { value: "ðŸ", names: ["Goat"] },
  { value: "ðŸ‘", names: ["Sheep"] },
  { value: "ðŸŽ", names: ["Racehorse"] },
  { value: "ðŸ–", names: ["Pig"] },
  { value: "ðŸ“", names: ["Rooster"] },
];

const CATEGORY_TAG_OPTIONS = [
  "Security & Access Control",
  "Transportation & Mobility",
  "Utilities & Infrastructure",
  "Facility Management",
  "Repairs & Home Services",
  "Emergency Services",
  "Wellness & Health",
  "Domestic Help",
  "Food & Groceries",
  "Laundry & Cleaning",
  "Pet Services",
  "Recreation & Events",
  "Education & Kids",
  "Marketplace & Classifieds",
  "Estate Dues & Payments",
  "Resident Records",
  "Communication",
  "Smart Home & IoT",
  "Insurance",
  "Legal & Compliance",
  "Real Estate Services",
  "Corporate / SME Services",
];

const DEFAULT_CATEGORY_TAG = CATEGORY_TAG_OPTIONS[0];

// Normalize to a unique set of emoji options (strip variation selectors to avoid duplicate keys)
const normalizeEmoji = (val: string) => (val || "").replace(/\uFE0F/g, "").trim();
const EMOJI_OPTIONS = Array.from(
  new Map(
    EMOJI_GROUPS.map(({ value, names }) => {
      const normalized = normalizeEmoji(value);
      return [normalized, names[0] || "Emoji"];
    }),
  ).entries(),
)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => String(a.label).localeCompare(String(b.label)));

// Admin auth context (local to this page file)
type AdminUser = any;

const normalizeAdminUser = (rawUser: any): AdminUser | null => {
  if (!rawUser) return null;
  return {
    ...rawUser,
    memberships: Array.isArray(rawUser.memberships) ? rawUser.memberships : [],
        details: [],
        businessAddress: "",
        businessCity: "",
        businessState: "",
        businessZipCode: "",
        businessCountry: "",
        businessType: "",
        businessRegNumber: "",
        businessTaxId: "",
        bankAccountName: "",
        bankName: "",
        bankAccountNumber: "",
        bankRoutingNumber: "",
  };
};

const AdminAuthContext = createContext<
  | {
      user: AdminUser | null;
      token: string | null;
      selectedEstateId: string | null;
      setSelectedEstateId: (id: string | null) => void;
      login: (email: string, password: string) => Promise<any>;
      logout: () => void;
      isLoading: boolean;
      sessionChecked: boolean;
    }
  | null
>(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
};

interface AdminAuthProviderProps {
  children: ReactNode;
}

export const AdminAuthProvider = ({ children }: AdminAuthProviderProps) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [selectedEstateId, setSelectedEstateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [, setLocation] = useLocation();

  // Update global token reference when token changes
  useEffect(() => {
    setAdminToken(token);
  }, [token]);

  // Update global estate context when selectedEstateId changes
  useEffect(() => {
    setCurrentEstate(selectedEstateId);
  }, [selectedEstateId]);

  // Listen for auth failure events from adminApiRequest
  useEffect(() => {
    const handleAuthFailure = () => {
      logout();
    };
    window.addEventListener("admin-auth-failed", handleAuthFailure);
    return () =>
      window.removeEventListener("admin-auth-failed", handleAuthFailure);
  }, []);

  // Auto-refresh token on mount if refresh token exists
  useEffect(() => {
    const refreshTokenFromStorage = sessionStorage.getItem(
      "admin_refresh_token",
    );
    if (refreshTokenFromStorage && !token) {
      refreshToken();
    }
  }, []);

  useEffect(() => {
    if (sessionChecked) return;
    let cancelled = false;

    const bootstrapSession = async () => {
      try {
        const sessionUser: any = await adminApiRequest("GET", "/api/user");
        if (cancelled) return;
        const normalizedUser = normalizeAdminUser(sessionUser);
        setUser(normalizedUser);
        const memberships = normalizedUser?.memberships || [];
        if (memberships.length > 0 && !selectedEstateId) {
          setSelectedEstateId(memberships[0].estateId);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setSessionChecked(true);
        }
      }
    };

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [sessionChecked, selectedEstateId]);

  const refreshToken = async () => {
    const refreshTokenValue = sessionStorage.getItem("admin_refresh_token");
    if (!refreshTokenValue) return;

    try {
      const response: any = await adminApiRequest(
        "POST",
        "/api/admin/auth/refresh",
        {
          refreshToken: refreshTokenValue,
        },
      );

      // Race-proof: Set tokens immediately
      setAdminToken(response.accessToken);
      setToken(response.accessToken);
      const normalizedUser = normalizeAdminUser(response.user);
      setUser(normalizedUser);
      sessionStorage.setItem("admin_refresh_token", response.refreshToken);

      // Restore estate selection if user has memberships
      const memberships = normalizedUser?.memberships || [];
      if (memberships.length > 0 && !selectedEstateId) {
        const firstEstate = memberships[0].estateId;
        setSelectedEstateId(firstEstate);
      }
      setSessionChecked(true);
    } catch (error) {
      // Refresh failed, clear tokens and redirect to login
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
        const response: any = await adminApiRequest(
          "POST",
          "/api/login",
          { username: email, password },
        );

        // Support two response shapes:
        // 1) token-based: { accessToken, refreshToken, user }
        // 2) session-based: user object returned directly
        const userObj = response?.user || response;
        const accessToken = response?.accessToken ?? null;
        const refreshToken = response?.refreshToken ?? null;

        // Race-proof: Set tokens immediately if present
        if (accessToken) {
          setAdminToken(accessToken);
          setToken(accessToken);
          sessionStorage.setItem("admin_access_token", accessToken);
        }
        if (refreshToken) {
          sessionStorage.setItem("admin_refresh_token", refreshToken);
        }

        const normalizedUser = normalizeAdminUser(userObj);
        setUser(normalizedUser);

        // Auto-select first estate for tenant scoping
        const memberships = normalizedUser?.memberships || [];
        if (memberships.length > 0) {
          const firstEstate = memberships[0].estateId;
          setSelectedEstateId(firstEstate);
        }
        setSessionChecked(true);

      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear tokens everywhere
    setAdminToken(null);               // <- ensures adminApi stops sending Authorization
    setToken(null);
    setUser(null);
    setSelectedEstateId(null);
    setSessionChecked(true);

    sessionStorage.removeItem("admin_refresh_token");
    sessionStorage.removeItem("admin_access_token");
    localStorage.removeItem("admin_jwt");

    // Bounce back to login
    setLocation("/");
  };


  return (
    <AdminAuthContext.Provider
      value={{
        user,
        token,
        selectedEstateId,
        setSelectedEstateId,
        login,
        logout,
        isLoading,
        sessionChecked,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

// Legacy API request function - now uses centralized adminApiRequest

// Admin Login Component
const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAdminAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Login Successful",
        description: "Welcome to CityConnect Admin Dashboard",
      });
      setLocation("/admin-dashboard/dashboard");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            CityConnect Admin
          </CardTitle>
          <p className="text-muted-foreground">Multi-tenant Admin Dashboard</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cityconnect.com"
                required
                data-testid="input-admin-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                required
                data-testid="input-admin-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-admin-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Sidebar Navigation
const AdminSidebar = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}) => {
  const { user, logout } = useAdminAuth();
  const [location, setLocation] = useLocation();
  const menuItems: Array<{ id: string; label: string; icon: any }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "estates", label: "Estates", icon: Building2 },
    { id: "users", label: "Users", icon: Users },
    { id: "providers", label: "Providers", icon: UserCheck },
    { id: "companies", label: "Companies", icon: Briefcase },
    { id: "stores", label: "Stores", icon: Store },
    { id: "item-categories", label: "Item Categories", icon: Tags },
    { id: "categories", label: "Categories", icon: Tags },
    { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
     { id: "artisanRequests", label: "Book an Artisan", icon: Wrench },
    { id: "requests", label: "Service Requests", icon: ClipboardList },
    { id: "orders", label: "Orders", icon: Package },
    { id: "analytics", label: "Analytics", icon: FileBarChart },
    { id: "notifications", label: "Notifications", icon: MessageSquare },
    
    { id: "audit", label: "Audit Logs", icon: Shield },

  ];

  const isSuperAdmin = user?.globalRole === "super_admin";

  if (isSuperAdmin) {
    menuItems.push(
      { id: "ai-conversations", label: "AI Conversations", icon: MessageSquare },
      { id: "ai-conversation-flow", label: "AI Conversation Flow", icon: Settings },
      { id: "ai-prepared-requests", label: "AI Prepared Requests", icon: MessageSquare },
      { id: "pricing-rules", label: "Pricing Rules", icon: Tags },
      { id: "provider-matching", label: "Provider Matching", icon: UserCheck },
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50
        transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:relative lg:z-0
        flex flex-col overflow-hidden
      `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              CityConnect Admin
            </h1>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.globalRole?.replace("_", " ").toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-4 pb-2 space-y-2 lg:hidden">
          {/* Mobile-only copies of the action buttons (desktop copies live in header) */}
          <Link href="/company-registration">
            <Button variant="secondary" className="w-full flex items-center justify-center sm:justify-start px-3 py-2">
              <Building2 className="w-4 h-4" />
              <span className="ml-2 hidden sm:inline">Register a business</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full flex items-center justify-center sm:justify-start px-3 py-2"
            onClick={() => {
              setLocation("/admin-dashboard/providers");
              setIsMobileOpen(false);
            }}
          >
            <UserPlus className="w-4 h-4" />
            <span className="ml-2 hidden sm:inline">Add provider</span>
          </Button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            // Hide estate-specific features for non-super admins without proper access
            if (!isSuperAdmin && ["estates", "audit"].includes(item.id)) {
              return null;
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileOpen(false);
                }}
                className={`
                  w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }
                `}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            className="w-full"
            onClick={logout}
            data-testid="button-logout"

>
            Logout
          </Button>
        </div>
      </div>
    </>
  );
};

const AiConversationsPanel = () => {
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery<any[]>({
    queryKey: ["admin-ai-conversations"],
    queryFn: () => adminApiRequest("GET", "/api/admin/ai/conversations"),
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Super admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Conversations</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load AI conversations.</p>
        ) : (
          <div className="w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conversation</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Approach</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows || []).map((r: any) => (
                  <TableRow key={r.conversationId}>
                    <TableCell className="font-mono text-xs">{r.conversationId}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>{r.urgency}</TableCell>
                    <TableCell>{r.recommendedApproach}</TableCell>
                    <TableCell>{Number.isFinite(Number(r.confidenceScore)) ? Number(r.confidenceScore) : "â€”"}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "â€”"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AiPreparedRequestsPanel = () => {
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery<any[]>({
    queryKey: ["admin-ai-prepared-requests"],
    queryFn: () => adminApiRequest("GET", "/api/admin/ai/prepared-requests"),
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Prepared Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Super admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Prepared Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load prepared requests.</p>
        ) : (
          <div className="w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead>Estimate</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows || []).map((r: any) => {
                  const est = r.priceEstimate;
                  const estimateText =
                    est && Number.isFinite(Number(est.min)) && Number.isFinite(Number(est.max))
                      ? `${Number(est.min)} - ${Number(est.max)}`
                      : "â€”";

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.resident}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>{r.urgency}</TableCell>
                      <TableCell className="max-w-[420px] truncate">{r.headline || "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.scope || "—"}</TableCell>
                      <TableCell>{Number.isFinite(Number(r.imageCount)) ? Number(r.imageCount) : 0}</TableCell>
                      <TableCell>{estimateText}</TableCell>
                      <TableCell>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "â€”"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// AI Conversation Flow Settings Panel
interface AiFlowSetting {
  id: string;
  categoryKey: string;
  categoryName: string;
  isEnabled: boolean;
  displayOrder: number;
  emoji: string | null;
  description: string | null;
  initialMessage: string | null;
  followUpSteps: any[] | null;
  confidenceThreshold: string | null;
  visualsHelpful: boolean;
  createdAt: string;
  updatedAt: string;
}

const AiConversationFlowPanel = () => {
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";
  const { toast } = useToast();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AiFlowSetting | null>(null);
  const [formData, setFormData] = useState({
    categoryKey: "",
    categoryName: "",
    emoji: "",
    description: "",
    initialMessage: "",
    followUpSteps: [] as string[],
    confidenceThreshold: "0.7",
    visualsHelpful: true,
  });

  const {
    data: settings = [],
    isLoading,
    error,
    refetch,
  } = useQuery<AiFlowSetting[]>({
    queryKey: ["admin-ai-conversation-flow"],
    queryFn: () => adminApiRequest("GET", "/api/admin/ai-conversation-flow"),
    enabled: isSuperAdmin,
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      adminApiRequest("POST", "/api/admin/ai-conversation-flow/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-conversation-flow"] });
      toast({ title: "Default categories seeded successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error seeding categories",
        description: error.response?.data?.message || "Failed to seed categories",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      adminApiRequest("POST", "/api/admin/ai-conversation-flow", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-conversation-flow"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Category created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating category",
        description: error.response?.data?.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminApiRequest("PATCH", `/api/admin/ai-conversation-flow/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-conversation-flow"] });
      setEditingItem(null);
      resetForm();
      toast({ title: "Category updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating category",
        description: error.response?.data?.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      adminApiRequest("DELETE", `/api/admin/ai-conversation-flow/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-conversation-flow"] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting category",
        description: error.response?.data?.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      adminApiRequest("PATCH", `/api/admin/ai-conversation-flow/${id}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-conversation-flow"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating category",
        description: error.response?.data?.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      adminApiRequest("PUT", "/api/admin/ai-conversation-flow/reorder", { orderedIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-conversation-flow"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error reordering categories",
        description: error.response?.data?.message || "Failed to reorder categories",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      categoryKey: "",
      categoryName: "",
      emoji: "",
      description: "",
      initialMessage: "",
      followUpSteps: [],
      confidenceThreshold: "0.7",
      visualsHelpful: true,
    });
  };

  const handleEdit = (item: AiFlowSetting) => {
    setEditingItem(item);
    setFormData({
      categoryKey: item.categoryKey,
      categoryName: item.categoryName,
      emoji: item.emoji || "",
      description: item.description || "",
      initialMessage: item.initialMessage || "",
      followUpSteps: item.followUpSteps || [],
      confidenceThreshold: item.confidenceThreshold || "0.7",
      visualsHelpful: item.visualsHelpful,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      followUpSteps: formData.followUpSteps.length > 0 ? formData.followUpSteps : null,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newOrder = [...settings];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map((s) => s.id));
  };

  const handleMoveDown = (index: number) => {
    if (index >= settings.length - 1) return;
    const newOrder = [...settings];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder.map((s) => s.id));
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Conversation Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Super admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>AI Conversation Flow Settings</CardTitle>
              <CardDescription>
                Manage categories displayed on the resident dashboard and customize AI conversations for each category.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {settings.length === 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  {seedMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Seed Default Categories
                </Button>
              )}
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="text-sm text-destructive">Failed to load AI conversation flow settings.</p>
          ) : settings.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No categories configured yet. Seed default categories or create one manually.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  {seedMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Seed Default Categories
                </Button>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Category
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Order</TableHead>
                    <TableHead>Emoji</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Visuals</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.map((item, index) => (
                    <TableRow key={item.id} className={!item.isEnabled ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground w-6">{item.displayOrder}</span>
                          <div className="flex flex-col gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                            >
                              <ChevronDown className="h-3 w-3 rotate-180" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => handleMoveDown(index)}
                              disabled={index === settings.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xl">{item.emoji || "📋"}</TableCell>
                      <TableCell className="font-medium">{item.categoryName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">{item.categoryKey}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {item.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.isEnabled}
                          onCheckedChange={(checked) =>
                            toggleEnabledMutation.mutate({ id: item.id, isEnabled: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.visualsHelpful ? "default" : "secondary"}>
                          {item.visualsHelpful ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit category</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`Delete "${item.categoryName}"?`)) {
                                      deleteMutation.mutate(item.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete category</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingItem(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Category" : "Create New Category"}
            </DialogTitle>
            <DialogDescription>
              Configure how this category appears on the resident dashboard and customize the AI conversation flow.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Category Key *</Label>
                <Input
                  value={formData.categoryKey}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryKey: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                  }
                  placeholder="e.g., plumber, electrician"
                  required
                  disabled={!!editingItem}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier (lowercase, underscores)
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">Category Name *</Label>
                <Input
                  value={formData.categoryName}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryName: e.target.value })
                  }
                  placeholder="e.g., Plumber, Electrician"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Emoji</Label>
                <Input
                  value={formData.emoji}
                  onChange={(e) =>
                    setFormData({ ...formData, emoji: e.target.value })
                  }
                  placeholder="e.g., 🔧, ⚡"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Confidence Threshold</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.confidenceThreshold}
                  onChange={(e) =>
                    setFormData({ ...formData, confidenceThreshold: e.target.value })
                  }
                  placeholder="0.7"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  AI confidence needed before proceeding (0-1)
                </p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description for this category"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Initial Message</Label>
              <Textarea
                value={formData.initialMessage}
                onChange={(e) =>
                  setFormData({ ...formData, initialMessage: e.target.value })
                }
                placeholder="The first message CityBuddy shows when this category is selected..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use AI-generated greeting
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="visualsHelpful"
                checked={formData.visualsHelpful}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, visualsHelpful: checked })
                }
              />
              <Label htmlFor="visualsHelpful" className="text-sm font-medium">
                Visuals Helpful (prompt user for photos)
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setEditingItem(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingItem ? "Update Category" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

const PricingRulesPanel = () => {
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    urgency: "",
    minPrice: "0",
    maxPrice: "0",
  });

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery<any[]>({
    queryKey: ["admin-pricing-rules"],
    queryFn: () => adminApiRequest("GET", "/api/admin/pricing-rules"),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (ruleData: any) =>
      adminApiRequest("POST", "/api/admin/pricing-rules", ruleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Pricing rule created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating pricing rule",
        description: error.response?.data?.error || "Failed to create pricing rule",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      urgency: "",
      minPrice: "0",
      maxPrice: "0",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Pricing rule name is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pricing Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Super admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Pricing Rules</CardTitle>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pricing Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load pricing rules.</p>
        ) : (rows || []).length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No pricing rules yet. Create one to get started.
            </p>
            <Button
              className="mt-4"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create First Rule
            </Button>
          </div>
        ) : (
          <div className="w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows || []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.category || "—"}</TableCell>
                    <TableCell>{r.urgency || "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.scope || "—"}</TableCell>
                    <TableCell>{r.minPrice}</TableCell>
                    <TableCell>{r.maxPrice}</TableCell>
                    <TableCell>{r.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "â€”"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Pricing Rule</DialogTitle>
            <DialogDescription>
              Add a pricing rule for a service category with a specific urgency level.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Rule Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Plumbing - Standard"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electrician">Electrician</SelectItem>
                    <SelectItem value="plumber">Plumber</SelectItem>
                    <SelectItem value="carpenter">Carpenter</SelectItem>
                    <SelectItem value="hvac_technician">HVAC Technician</SelectItem>
                    <SelectItem value="painter">Painter</SelectItem>
                    <SelectItem value="tiler">Tiler</SelectItem>
                    <SelectItem value="mason">Mason</SelectItem>
                    <SelectItem value="roofer">Roofer</SelectItem>
                    <SelectItem value="gardener">Gardener</SelectItem>
                    <SelectItem value="cleaner">Cleaner</SelectItem>
                    <SelectItem value="welder">Welder</SelectItem>
                    <SelectItem value="appliance_repair">Appliance Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Urgency</Label>
                <Select
                  value={formData.urgency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, urgency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Min Price</Label>
                <Input
                  type="number"
                  value={formData.minPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, minPrice: e.target.value })
                  }
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Max Price</Label>
                <Input
                  type="number"
                  value={formData.maxPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, maxPrice: e.target.value })
                  }
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {createMutation.isPending ? "Creating..." : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
};

const ProviderMatchingPanel = () => {
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery<any[]>({
    queryKey: ["admin-provider-matching"],
    queryFn: () => adminApiRequest("GET", "/api/admin/providers/matching"),
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Provider Matching</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Super admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Matching</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load provider matching settings.</p>
        ) : (
          <div className="w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows || []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell>{p.isApproved ? "Yes" : "No"}</TableCell>
                    <TableCell>{p.matching?.isEnabled === false ? "No" : "Yes"}</TableCell>
                    <TableCell>
                      {p.matching?.updatedAt ? new Date(p.matching.updatedAt).toLocaleString() : "â€”"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AnalyticsPanel = ({ orderStats }: { orderStats: any }) => {
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Super admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Analytics & Insights
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor orders, revenue, and platform performance metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{orderStats?.totalOrders || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">All orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              â‚¦{(orderStats?.totalRevenue || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Across all orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{orderStats?.completedOrders || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {orderStats?.totalOrders
                ? ((((orderStats?.completedOrders || 0) / (orderStats?.totalOrders || 1)) * 100).toFixed(1))
                : 0}
              % completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{orderStats?.pendingOrders || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Awaiting completion</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orderStats?.byStatus ? (
              Object.entries(orderStats.byStatus).map(([status, count]: [string, any]) => (
                <div key={status} className="flex items-center justify-between">
                  <p className="text-sm font-medium capitalize">{status}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${((count / (orderStats?.totalOrders || 1)) * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No order data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orderStats?.recentOrders && orderStats.recentOrders.length > 0 ? (
            <div className="space-y-2 text-sm">
              {orderStats.recentOrders.map((order: any) => (
                <div key={order.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{order.resident || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{order.service || order.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">â‚¦{(order.totalAmount || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground capitalize">{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent orders</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};



// Users Management Component
const UsersManagement = () => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"global" | "estate">("global");
  const [selectedEstateId, setSelectedEstateId] = useState<string>("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    globalRole: "",
    company: "",
  });
  const [showMemberships, setShowMemberships] = useState(false);
  const [membershipUser, setMembershipUser] = useState<any>(null);
  const [newMembership, setNewMembership] = useState({
    estateId: "",
    role: "",
  });
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [editingMembershipValues, setEditingMembershipValues] = useState({ estateId: "", role: "" });
  const [previewUser, setPreviewUser] = useState<any>(null);

  const { toast } = useToast();
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";
  const [, setLocation] = useLocation();

  const updateMembershipMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      adminApiRequest("PATCH", `/api/admin/memberships/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-memberships"] });
      // invalidate user-specific memberships if dialog open
      if (membershipUser) {
        const userId = membershipUser._id || membershipUser.id;
        queryClient.invalidateQueries({ queryKey: ["admin-user-memberships", userId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      toast({ title: "Membership updated" });
      setEditingMembershipId(null);
    },
  });

  const impersonateUserMutation = useMutation({
    mutationFn: (userId: string) => adminApiRequest("POST", `/api/admin/impersonate/${userId}`),
    onSuccess: () => {
      toast({
        title: "Impersonation started",
        description: "You are now impersonating this user.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Impersonation failed",
        description: error?.message || "Unable to impersonate user.",
        variant: "destructive",
      });
    },
  });

  // Initialize view mode from localStorage estate context
  useEffect(() => {
    const estateId = getCurrentEstate();
    if (estateId) {
      setViewMode("estate");
      setSelectedEstateId(estateId);
    } else {
      setViewMode("global");
    }
  }, []);

  // Users (unified) â€” array normalized for the table
  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: [
      `${import.meta.env.VITE_API_URL}/api/admin/users/all`,
      { search, role: roleFilter === "all" ? undefined : roleFilter, viewMode, selectedEstateId },
    ],
    queryFn: async () => {
      const r = await adminApiRequest("GET", "/api/admin/users/all", {
        search: search || undefined,
        role: roleFilter === "all" ? undefined : roleFilter, // 'admin' | 'resident' | 'provider'
      });
      // Always return an array for the table:
      return Array.isArray(r) ? r : (r?.items || []);
    },
  });

  // Optional alias (now just equals users)
  const rows = users;

  // Estates for both membership dialog and view mode selector
  const { data: estates } = useQuery({
    queryKey: ["admin-estates"],
    queryFn: () => adminApiRequest("GET", "/api/admin/estates"),
    enabled: showMemberships || isSuperAdmin, // Load for super admins or when managing memberships
  });

  // Companies (for provider dropdown)
  const { data: companies = [], isLoading: isCompaniesLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => adminApiRequest("GET", "/api/admin/companies"),
  });

  // Handle view mode changes
  const handleViewModeChange = (mode: "global" | "estate") => {
    setViewMode(mode);
    if (mode === "global") {
      // Clear estate context for global view
      setCurrentEstate(null);
      setSelectedEstateId("");
    } else if (mode === "estate" && selectedEstateId) {
      // Set estate context when switching to estate view
      setCurrentEstate(selectedEstateId);
    }
  };

  // Handle estate selection
  const handleEstateSelect = (estateId: string) => {
    setSelectedEstateId(estateId);
    setCurrentEstate(estateId);
    if (!viewMode || viewMode === "global") {
      setViewMode("estate");
    }
  };

  // Memberships query â€“ use the correct endpoint
  const { data: userMemberships } = useQuery({
    queryKey: ["admin-user-memberships", membershipUser?._id || membershipUser?.id],
    queryFn: () => {
      if (!membershipUser) return [];
      // Handle both MongoDB (_id) and PostgreSQL (id) user objects
      const userId = membershipUser._id || membershipUser.id;
      return adminApiRequest("GET", `/api/admin/users/${userId}/memberships`);
    },
    enabled: !!membershipUser,
  });

  // Toggle active/inactive â€“ use /api/admin/users/{id}
  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApiRequest("PATCH", `/api/admin/users/${userId}`, { isActive }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: `User ${variables.isActive ? "activated" : "deactivated"} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating user status",
        description:
          error.response?.data?.error || "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      adminApiRequest("DELETE", `/api/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting user",
        description: error.response?.data?.error || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Reset password (admin) â€“ calls server endpoint that may return a generated temp password
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordUser, setTempPasswordUser] = useState<any>(null);
  // Confirmation dialog state for resetting password
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmUserId, setResetConfirmUserId] = useState<string | null>(null);
  const [resetConfirmUser, setResetConfirmUser] = useState<any>(null);

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) =>
      adminApiRequest("POST", `/api/admin/users/${userId}/reset-password`),
    onSuccess: (data: any, userId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      // If server returned a generated temp password, show it in a modal so admin can copy it
      if (data?.tempPassword) {
        setTempPassword(data.tempPassword);
        // find the user in cache to show a friendly label
        const found = (users || []).find((u: any) => (u.id || u._id || u.email) === userId);
        setTempPasswordUser(found || { id: userId });
        setShowTempPasswordModal(true);
      } else {
        toast({ title: "Password reset successfully" });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error resetting password",
        description: error.response?.data?.error || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (userId?: string) => {
    if (!userId) return;
    const confirmed = confirm(
      "Deleting this user is permanent and cannot be undone. Continue?",
    );
    if (!confirmed) return;
    deleteUserMutation.mutate(userId);
  };

  // Create user â€“ POST to /api/admin/users
  const createUserMutation = useMutation({
    mutationFn: (userData: any) =>
      adminApiRequest("POST", "/api/admin/users", userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      setShowAddUser(false);
      resetForm();
      toast({ title: "User created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating user",
        description: error.response?.data?.error || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  // Update user â€“ PATCH to /api/admin/users/{id}
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: any }) =>
      adminApiRequest("PATCH", `/api/admin/users/${userId}`, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      resetForm();
      toast({ title: "User updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating user",
        description:
          error.response?.data?.error || "Failed to update user",
        variant: "destructive",
      });
    },
  });


  const handleToggleUserStatus = (userId: string, currentStatus: boolean) => {
    toggleUserStatusMutation.mutate({ userId, isActive: !currentStatus });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      globalRole: "",
      company: "",
    });
  };

  const handleOpenEditDialog = (user: any) => {
    setEditingUser(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      password: "",
      globalRole: user.globalRole || "",
      company: user.globalRole === "provider" ? user.company || "" : "",
    });
  };

  const createMembershipMutation = useMutation({
    mutationFn: (membershipData: any) =>
      adminApiRequest("POST", "/api/admin/memberships", membershipData),
    onSuccess: () => {
      // Invalidate all relevant queries to ensure UI consistency
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });

      // Reset form state
      setNewMembership({ estateId: "", role: "" });

      toast({ title: "Estate membership added successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding membership",
        description: error.response?.data?.error || "Failed to add membership",
        variant: "destructive",
      });
    },
  });

  const deleteMembershipMutation = useMutation({
    mutationFn: ({ userId, estateId }: { userId: string; estateId: string }) =>
      adminApiRequest("DELETE", `/api/admin/memberships/${userId}/${estateId}`),
    onSuccess: () => {
      // Invalidate all relevant queries to ensure UI consistency
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });

      toast({ title: "Membership removed successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing membership",
        description:
          error.response?.data?.error || "Failed to remove membership",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const { password, ...baseData } = formData;
    const payload = { ...baseData };
    if (payload.globalRole !== "provider") {
      delete (payload as any).company;
    } else if (!payload.company) {
      delete (payload as any).company; // treat "Independent" as no company
    }
    const userData = password ? { ...payload, password } : payload; // Only include password if provided

    if (editingUser) {
      // Handle both MongoDB (_id) and PostgreSQL (id) user objects
      const userId = editingUser._id || editingUser.id;
      updateUserMutation.mutate({ userId, userData });
    } else {
      createUserMutation.mutate(userData);
    }
  };

  const handleAddMembership = (estateId: string, role: string) => {
    if (!membershipUser) return;

    // Check for duplicate membership
    const existingMembership = userMemberships?.find(
      (membership: any) => membership.estateId === estateId,
    );

    if (existingMembership) {
      toast({
        title: "Duplicate membership",
        description: "User is already a member of this estate",
        variant: "destructive",
      });
      return;
    }

    // Handle both MongoDB (_id) and PostgreSQL (id) user objects
    const userId = membershipUser._id || membershipUser.id;
    createMembershipMutation.mutate({
      userId,
      estateId,
      role,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              User Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage users and their estate assignments
            </p>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowAddUser(true)}
            data-testid="button-add-user"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Global/Estate Toggle - Only for Super Admins */}
        {isSuperAdmin && (
          <Card className={viewMode === "global" ? "bg-purple-500/5 dark:bg-purple-500/10" : "bg-teal-500/5 dark:bg-teal-500/10"}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* Toggle Buttons */}
                <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1 h-10">
                  <Button
                    variant={viewMode === "global" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("global")}
                    className={`transition-all duration-200 ${
                      viewMode === "global"
                        ? "bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                        : ""
                    }`}
                    data-testid="button-view-global"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Global
                  </Button>
                  <Button
                    variant={viewMode === "estate" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("estate")}
                    className={`transition-all duration-200 ${
                      viewMode === "estate"
                        ? "bg-teal-500 hover:bg-teal-600 text-white shadow-[0_0_20px_rgba(20,184,166,0.15)]"
                        : ""
                    }`}
                    data-testid="button-view-estate"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Estate
                  </Button>
                </div>

                {/* Estate Selector - Shows when Estate mode is active */}
                {viewMode === "estate" && (
                  <Select value={selectedEstateId} onValueChange={handleEstateSelect}>
                  <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-estate-filter">
                    <SelectValue placeholder="Select an estate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estates && estates.length > 0 ? (
                      estates.map((estate: any, idx: number) => {
                        const estateId = estate._id || estate.id || estate.slug || `estate-${idx}`;
                        return (
                          <SelectItem key={estateId} value={estateId}>
                            <div className="flex flex-col">
                              <span className="font-medium">{estate.name}</span>
                              <span className="text-xs text-muted-foreground">{estate.address}</span>
                            </div>
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>
                        No estates available
                      </SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                )}

                {/* Context Badge */}
                <div className="flex-1">
                  <Badge
                    variant="outline"
                    className={`text-sm ${
                      viewMode === "global"
                        ? "border-purple-500 text-purple-600 dark:text-purple-400"
                        : "border-teal-500 text-teal-600 dark:text-teal-400"
                    }`}
                  >
                    {viewMode === "global" ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                        Viewing all users globally
                      </>
                    ) : selectedEstateId ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-teal-500 mr-2"></div>
                        Estate: {estates?.find((e: any) => e._id === selectedEstateId)?.name || "Selected"}
                      </>
                    ) : (
                      <>Please select an estate</>
                    )}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-users"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger
                  className="w-48"
                  data-testid="select-role-filter"
                >
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                  <SelectItem value="estate_admin">Estate Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                
                   {rows.map((user: any) => {
  const userId = user.id || user._id || user.email;
  return (
  <TableRow key={userId}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.globalRole === "super_admin"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          user.globalRole === "resident"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 border-purple-200 dark:border-purple-700"
                            : undefined
                        }
                      >
                        {user.globalRole || "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.isActive ? "default" : "destructive"}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditDialog(user)}
                              data-testid={`button-edit-user-${userId}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit user details</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setMembershipUser(user);
                                setShowMemberships(true);
                              }}
                              data-testid={`button-estates-user-${userId}`}
                            >
                              <Building2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Manage estate memberships</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={
                                user.isActive ? "destructive" : "default"
                              }
                              size="sm"
                              onClick={() =>
                                handleToggleUserStatus(
                                  userId,
                                  user.isActive,
                                )
                              }
                              disabled={toggleUserStatusMutation.isPending}
                              data-testid={`button-toggle-user-${userId}`}
                            >
                              {user.isActive ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {user.isActive
                                ? "Deactivate user"
                                : "Activate user"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewUser(user)}
                              data-testid={`button-preview-user-${userId}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Preview user details</p>
                          </TooltipContent>
                        </Tooltip>
                        {isSuperAdmin && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => impersonateUserMutation.mutate(userId)}
                                data-testid={`button-impersonate-user-${userId}`}
                              >
                                <UserCheck className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Impersonate user</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(userId)}
                              disabled={deleteUserMutation.isPending}
                              data-testid={`button-delete-user-${userId}`}
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete user permanently</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setResetConfirmUser(user);
                                setResetConfirmUserId(userId);
                                setResetConfirmOpen(true);
                              }}
                              disabled={(resetPasswordMutation as any).isPending || false}
                              data-testid={`button-reset-password-${userId}`}
                            >
                              <ShieldOff className="w-4 h-4 text-yellow-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reset password</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
                })}
                {(!users || users.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add/Edit User Dialog */}
        <Dialog
          open={showAddUser || editingUser !== null}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddUser(false);
              setEditingUser(null);
            }
          }}
        >
          <DialogContent className="w-[70vw] max-w-5xl">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Edit User" : "Add New User"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Update user information and permissions."
                  : "Create a new user account."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                data-testid="input-user-name"
              />
              <Input
                placeholder="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                data-testid="input-user-email"
              />
              <Input
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                data-testid="input-user-phone"
              />
              {formData.globalRole === "provider" && (
                <Select
                  value={formData.company || "independent"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      company: value === "independent" ? "" : value,
                    })
                  }
                  disabled={isCompaniesLoading}
                >
                  <SelectTrigger data-testid="select-user-company">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="independent">Independent</SelectItem>
                      {Array.isArray(companies) &&
                        companies
                          .filter((company: any) => !!company?.name)
                          .map((company: any) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                  </SelectContent>
                </Select>
              )}
              {!editingUser && (
                <Input
                  placeholder="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  data-testid="input-user-password"
                />
              )}
              <Select
                value={formData.globalRole}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    globalRole: value,
                    company: value === "provider" ? formData.company : "",
                  })
                }
              >
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Global Role</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                  <SelectItem value="estate_admin">Estate Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddUser(false);
                  setEditingUser(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createUserMutation.isPending || updateUserMutation.isPending
                }
                data-testid="button-save-user"
              >
                {createUserMutation.isPending || updateUserMutation.isPending
                  ? "Saving..."
                  : editingUser
                    ? "Update User"
                    : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Estate Membership Management Dialog */}
        <Dialog open={showMemberships} onOpenChange={setShowMemberships}>
          <DialogContent className="w-[70vw] max-w-5xl">
            <DialogHeader>
              <DialogTitle>
                Manage Estate Memberships - {membershipUser?.name}
              </DialogTitle>
              <DialogDescription>
                Assign or remove this user from estates and manage their roles.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {/* Current Memberships */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Current Estate Memberships</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {userMemberships?.map((membership: any) => (
                    <div key={`${membership.userId}-${membership.estateId}`}>
                      {editingMembershipId === membership.id ? (
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex space-x-2 items-center">
                            <Select
                              value={editingMembershipValues.estateId}
                              onValueChange={(value) =>
                                setEditingMembershipValues({ ...editingMembershipValues, estateId: value })
                              }
                            >
                              <SelectTrigger className="min-w-[200px]">
                                <SelectValue placeholder="Select Estate" />
                              </SelectTrigger>
                              <SelectContent>
                                {estates?.map((estate: any, idx: number) => {
                                  const estateId = estate._id || estate.id || String(idx);
                                  return (
                                    <SelectItem key={estateId} value={estateId}>
                                      {estate.name}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>

                            <Select
                              value={editingMembershipValues.role}
                              onValueChange={(value) =>
                                setEditingMembershipValues({ ...editingMembershipValues, role: value })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="resident">Resident</SelectItem>
                                <SelectItem value="provider">Provider</SelectItem>
                                <SelectItem value="estate_admin">Estate Admin</SelectItem>
                                <SelectItem value="moderator">Moderator</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                updateMembershipMutation.mutate({
                                  id: membership.id,
                                  updates: editingMembershipValues,
                                })
                              }
                              disabled={updateMembershipMutation.isPending}
                            >
                              {updateMembershipMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingMembershipId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`membership-${membership.estateId}`}
                        >
                          <div>
                            <span className="font-medium">{membership.estateName || `Estate ${membership.estateId}`}</span>
                            <Badge variant="secondary" className="ml-2">
                              {membership.role}
                            </Badge>
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingMembershipId(membership.id);
                                setEditingMembershipValues({ estateId: membership.estateId, role: membership.role });
                              }}
                            >
                              Edit
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                deleteMembershipMutation.mutate({
                                  userId: membership.userId,
                                  estateId: membership.estateId,
                                })
                              }
                              disabled={deleteMembershipMutation.isPending}
                              data-testid={`button-remove-membership-${membership.estateId}`}
                            >
                              {deleteMembershipMutation.isPending ? "Removing..." : "Remove"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {(!userMemberships || userMemberships.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">
                      No estate memberships found
                    </p>
                  )}
                </div>
              </div>

              {/* Add New Membership */}
              <div>
                <h4 className="font-medium mb-3">Add Estate Membership</h4>
                <div className="flex space-x-2">
                  <Select
                    value={newMembership.estateId}
                    onValueChange={(value) =>
                      setNewMembership({ ...newMembership, estateId: value })
                    }
                  >
                    <SelectTrigger
                      className="flex-1"
                      data-testid="select-estate"
                    >
                      <SelectValue placeholder="Select Estate" />
                    </SelectTrigger>
                    <SelectContent>
                      {estates?.map((estate: any, idx: number) => {
                        const estateId = estate._id || estate.id || String(idx);
                        return (
                          <SelectItem key={estateId} value={estateId}>
                            {estate.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newMembership.role}
                    onValueChange={(value) =>
                      setNewMembership({ ...newMembership, role: value })
                    }
                  >
                    <SelectTrigger
                      className="w-40"
                      data-testid="select-estate-role"
                    >
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resident">Resident</SelectItem>
                      <SelectItem value="provider">Provider</SelectItem>
                      <SelectItem value="estate_admin">Estate Admin</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      if (newMembership.estateId && newMembership.role) {
                        handleAddMembership(
                          newMembership.estateId,
                          newMembership.role,
                        );
                        setNewMembership({ estateId: "", role: "" }); // Reset form
                      }
                    }}
                    disabled={
                      createMembershipMutation.isPending ||
                      !newMembership.estateId ||
                      !newMembership.role
                    }
                    data-testid="button-add-membership"
                  >
                    {createMembershipMutation.isPending ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowMemberships(false);
                  setMembershipUser(null);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview User Dialog */}
        <Dialog open={!!previewUser} onOpenChange={(open) => !open && setPreviewUser(null)}>
        <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-3xl w-[90vw] max-h-[85vh] overflow-auto p-0 bg-transparent border-0 shadow-none">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-purple-700 to-blue-700" />
          <DialogHeader>
            <DialogTitle className="sr-only">User Preview</DialogTitle>
            <DialogDescription className="sr-only">Quick view of user details.</DialogDescription>
          </DialogHeader>

            <div className="relative px-6 pb-6 pt-6">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white dark:border-gray-900 shadow-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-sm text-muted-foreground">
                    {previewUser?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {previewUser?.name || "Unnamed User"}
                      </h2>
                      <Badge variant={previewUser?.isActive ? "default" : "destructive"}>
                        {previewUser?.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <p className="text-sm text-muted-foreground break-all">
                        {previewUser?.email || "No email"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {previewUser?.phone || "No phone"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {previewUser?.globalRole || previewUser?.role || "User"}
                      </Badge>
                      {previewUser?.lastLoginAt && (
                        <span className="text-xs text-muted-foreground">
                          Last login: {new Date(previewUser.lastLoginAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border bg-gray-50 dark:bg-gray-800/50 p-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {previewUser?.isActive ? "Active account" : "Inactive account"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-gray-50 dark:bg-gray-800/50 p-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Role</p>
                    <p className="text-sm text-muted-foreground">
                      {previewUser?.globalRole || previewUser?.role || "User"}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setPreviewUser(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Confirmation dialog before performing reset */}
        <Dialog open={resetConfirmOpen} onOpenChange={(open) => setResetConfirmOpen(open)}>
          <DialogContent className="w-[70vw] max-w-5xl">
            <DialogHeader>
              <DialogTitle>Confirm password reset</DialogTitle>
              <DialogDescription>
                Are you sure you want to reset the password for {resetConfirmUser?.email || resetConfirmUser?.name || resetConfirmUserId}?
                This will generate a temporary password if none is provided.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!resetConfirmUserId) return;
                  resetPasswordMutation.mutate(resetConfirmUserId);
                  setResetConfirmOpen(false);
                  setResetConfirmUserId(null);
                  setResetConfirmUser(null);
                }}
                disabled={(resetPasswordMutation as any).isPending || false}
              >
                {(resetPasswordMutation as any).isPending ? "Resetting..." : "Confirm reset"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Temp password modal shown after admin-triggered reset */}
        <Dialog open={showTempPasswordModal} onOpenChange={(open) => !open && setShowTempPasswordModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Temporary Password</DialogTitle>
              <DialogDescription>
                A temporary password was generated for this user. Copy it and share securely.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="rounded border p-3 bg-gray-50 dark:bg-gray-800">
                <p className="text-sm font-medium">User</p>
                <p className="text-sm text-muted-foreground break-all">{tempPasswordUser?.email || tempPasswordUser?.name || tempPasswordUser?.id}</p>
              </div>
              <div className="rounded border p-3 bg-white dark:bg-gray-900 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Temporary password</p>
                  <p className="text-lg font-semibold tracking-wide">{tempPassword}</p>
                </div>
                <div className="flex flex-col space-y-2">
                  <Button
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(tempPassword || "");
                        toast({ title: "Copied to clipboard" });
                      } catch (e) {
                        toast({ title: "Unable to copy", variant: "destructive" });
                      }
                    }}
                  >
                    Copy
                  </Button>
                  <Button variant="outline" onClick={() => setShowTempPasswordModal(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

// Providers Management Component
const ProvidersManagement = () => {
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"global" | "estate">("global");
  const [selectedEstateId, setSelectedEstateId] = useState("");
  const [previewProvider, setPreviewProvider] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string>("");
  const [previewData, setPreviewData] = useState({
    firstName: "",
    lastName: "",
    name: "",
    email: "",
    phone: "",
    company: "",
    categories: [] as string[],
    experience: 0,
    description: "",
  });
  const providerRequestCountRef = useRef(0);
  const providerRequestInitializedRef = useRef(false);

  const { toast } = useToast();
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";

  // Initialize view mode from localStorage estate context
  useEffect(() => {
    const estateId = getCurrentEstate();
    if (estateId) {
      setViewMode("estate");
      setSelectedEstateId(estateId);
    } else {
      setViewMode("global");
    }
  }, []);

  // Fetch estates for the dropdown
  const { data: estates } = useQuery({
    queryKey: [`${import.meta.env.VITE_API_URL}/api/admin/estates`],
    queryFn: () => adminApiRequest("GET", "/api/admin/estates"),
    enabled: isSuperAdmin,
  });

  const handleViewModeChange = (mode: "global" | "estate") => {
    setViewMode(mode);
    if (mode === "global") {
      setCurrentEstate(null);
      setSelectedEstateId("");
    }
  };

  const handleEstateSelect = (estateId: string) => {
    setSelectedEstateId(estateId);
    setCurrentEstate(estateId);
  };

  const providerForm = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      company: "",
      categories: [],
      experience: 0,
      description: "",
      isApproved: false,
    },
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: [
      "/api/admin/users",
      {
        role: "provider",
        search,
        approved: approvalFilter,
        viewMode,
        selectedEstateId,
      },
    ],
    queryFn: () =>
      adminApiRequest("GET", "/api/admin/users/all", {
        role: "provider",
        search: search || undefined,
      }),
  });

  const { data: companies = [], isLoading: isCompaniesLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => adminApiRequest("GET", "/api/admin/companies"),
  });

  // Memberships cache for provider->estate mapping
  const { data: memberships = [] } = useQuery({
    queryKey: ["admin-memberships"],
    queryFn: () => adminApiRequest("GET", "/api/admin/memberships"),
    staleTime: 10_000,
  });

  // Service categories come from the Categories module so every dropdown stays in sync
  const { data: categoriesList = [] } = useQuery({
    queryKey: ["/api/admin/categories"],
    queryFn: () => adminApiRequest("GET", "/api/admin/categories"),
  });
  const { data: providerRequests = [] } = useQuery({
    queryKey: ["admin/provider-requests"],
    queryFn: () => adminApiRequest("GET", "/api/admin/provider-requests"),
    refetchInterval: 15_000,
    staleTime: 15_000,
  });
  const categoryOptions =
    Array.isArray(categoriesList) && categoriesList.length > 0
      ? Array.from(
          new Map(
            categoriesList
              .filter((c: any) => c?.key || c?.name)
              .map((c: any) => {
                const value = c.key || c.name;
                return [value, { value, label: c.name || c.key }];
              }),
          ).values(),
        )
      : [
      { value: "surveillance_monitoring", label: "Surveillance monitoring" },
      { value: "cleaning_janitorial", label: "Cleaning & janitorial" },
      { value: "catering_services", label: "Catering Services" },
      { value: "it_support", label: "IT Support" },
      { value: "maintenance_repair", label: "Maintenance & Repair" },
      { value: "marketing_advertising", label: "Marketing & Advertising" },
      { value: "home_tutors", label: "Home tutors" },
      { value: "furniture_making", label: "Furniture making" },
    ];
  useEffect(() => {
    if (!providerRequestInitializedRef.current) {
      providerRequestInitializedRef.current = true;
      providerRequestCountRef.current = providerRequests.length;
      return;
    }
    if (providerRequests.length > providerRequestCountRef.current) {
      const diff = providerRequests.length - providerRequestCountRef.current;
      const newest = providerRequests[0];
      toast({
        title: `${diff} new provider request${diff > 1 ? "s" : ""}`,
        description: newest?.name
          ? `${newest.name} just submitted a request.`
          : undefined,
      });
    }
    providerRequestCountRef.current = providerRequests.length;
  }, [providerRequests, toast]);
  const assignEstateMutation = useMutation({
    mutationFn: ({ providerId, estateId }: { providerId: string; estateId: string }) =>
      adminApiRequest("POST", "/api/admin/memberships", {
        userId: providerId,
        estateId,
        role: "provider",
      }),
    onSuccess: () => {
      toast({ title: "Provider assigned to estate" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-memberships"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error assigning estate",
        description: error.response?.data?.error || "Failed to assign estate",
        variant: "destructive",
      });
    },
  });
  const removeEstateMutation = useMutation({
    mutationFn: ({ providerId, estateId }: { providerId: string; estateId: string }) =>
      adminApiRequest("DELETE", `/api/admin/memberships/${providerId}/${estateId}`),
    onSuccess: () => {
      toast({ title: "Estate removed from provider" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-memberships"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing estate",
        description: error.response?.data?.error || "Failed to remove estate",
        variant: "destructive",
      });
    },
  });
  const companyOptions = Array.isArray(companies)
    ? companies.filter((company: any) => !!company?.name)
    : [];

  const approveMutation = useMutation({
    // Use the unified users endpoint to toggle approval to avoid depending on
    // an unstable providers-specific approval route. This updates the user's
    // `isApproved` flag directly.
    mutationFn: ({ providerId, approved }: { providerId: string; approved: boolean }) =>
      adminApiRequest("PATCH", `/api/admin/users/${providerId}`, { isApproved: approved }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      toast({
        title: `Provider ${variables.approved ? "approved" : "rejected"} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating provider status",
        description:
          error.response?.data?.error || "Failed to update provider status",
        variant: "destructive",
      });
    },
  });

  const createProviderMutation = useMutation({
    mutationFn: (providerData: CreateProviderInput) =>
      adminApiRequest("POST", "/api/admin/providers", providerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      setShowAddProvider(false);
      setEditingProvider(null);
      providerForm.reset();
      toast({ title: "Provider created successfully" });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.details?.length
        ? error.response.data.details.join(", ")
        : error.response?.data?.error || "Failed to create provider";

      toast({
        title: "Error creating provider",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleApproval = (providerId: string, approved: boolean) => {
    approveMutation.mutate({ providerId, approved });
  };

  const updateProviderFormMutation = useMutation({
    mutationFn: ({ providerId, data }: { providerId: string; data: Partial<CreateProviderInput> }) =>
      adminApiRequest("PATCH", `/api/admin/users/${providerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      setEditingProvider(null);
      setShowAddProvider(false);
      providerForm.reset();
      toast({ title: "Provider updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating provider",
        description: error.response?.data?.error || "Failed to update provider",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateProviderInput) => {
    if (editingProvider) {
      const providerId = editingProvider.id || editingProvider._id;
      const payload: any = { ...data };
      if (!payload.password) delete payload.password;
      updateProviderFormMutation.mutate({ providerId, data: payload });
    } else {
      if (!data.password || data.password.trim().length < 6) {
        toast({
          title: "Password required",
          description: "New providers must have a password (min 6 characters).",
          variant: "destructive",
        });
        return;
      }
      createProviderMutation.mutate(data);
    }
  };

  // Client-side filtering for approval status
  const filteredProviders = providers
    ?.filter((provider: any) => {
      if (approvalFilter === "true") return provider.isApproved === true;
      if (approvalFilter === "false") return provider.isApproved === false;
      return true;
    })
    ?.filter((provider: any) => {
      if (categoryFilter === "all") return true;
      return Array.isArray(provider.categories) && provider.categories.includes(categoryFilter);
    })
    ?.filter((provider: any) => {
      if (companyFilter === "all") return true;
      if (companyFilter === "independent") return !provider.company;
      return (provider.company || "").toLowerCase() === companyFilter.toLowerCase();
    })
    ?.filter((provider: any) => {
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return (
        provider.name?.toLowerCase().includes(needle) ||
        provider.email?.toLowerCase().includes(needle) ||
        provider.categories?.some((c: string) => c.toLowerCase().includes(needle))
      );
    });

  // Get unique companies for filter (all providers will show as Independent since PostgreSQL doesn't have company field yet)
  const uniqueCompanies = Array.from(
    new Set(filteredProviders?.map((p: any) => p.company).filter(Boolean))
  );

  const updateProviderMutation = useMutation({
    mutationFn: ({
      providerId,
      data,
    }: {
      providerId: string;
      data: Partial<CreateProviderInput> & Record<string, any>;
    }) => adminApiRequest("PATCH", `/api/admin/users/${providerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bridge/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      setPreviewProvider(null);
      toast({ title: "Provider updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating provider",
        description: error.response?.data?.error || "Failed to update provider",
        variant: "destructive",
      });
    },
  });

  const openPreview = (provider: any) => {
    setPreviewProvider(provider);
    setPreviewImage(provider.avatar || "");
    setPreviewData({
        firstName: provider.firstName || (provider.name ? provider.name.split(" ")[0] : ""),
        lastName: provider.lastName || (provider.name ? provider.name.split(" ").slice(1).join(" ") : ""),
        email: provider.email || "",
        phone: provider.phone || "",
        company: provider.company || "",
        categories: Array.isArray(provider.categories) ? provider.categories : [],
        experience: provider.experience || 0,
        description: provider.description || "",
        name: ""
    });
  };

  const openEditProvider = (provider: any) => {
    setEditingProvider(provider);
    setShowAddProvider(true);
    providerForm.reset({
      firstName: provider.firstName || (provider.name ? provider.name.split(" ")[0] : ""),
      lastName: provider.lastName || (provider.name ? provider.name.split(" ").slice(1).join(" ") : ""),
      email: provider.email || "",
      phone: provider.phone || "",
      password: "",
      company: provider.company || "",
      categories: Array.isArray(provider.categories) ? provider.categories : [],
      experience: provider.experience || 0,
      description: provider.description || "",
      isApproved: !!provider.isApproved,
    });
  };

  const handleSavePreview = () => {
    if (!previewProvider) return;
    const providerId = previewProvider.id || previewProvider._id;
    if (!providerId) {
      toast({
        title: "Update failed",
        description: "Missing provider identifier",
        variant: "destructive",
      });
      return;
    }

    updateProviderMutation.mutate({
      providerId,
      data: {
        ...previewData,
        avatar: previewImage,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Provider Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Approve and manage service providers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {providerRequests.length > 0 && (
            <Badge variant="secondary" className="text-xs uppercase tracking-wide">
              {providerRequests.length} new request
              {providerRequests.length > 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            onClick={() => setShowAddProvider(true)}
            data-testid="button-add-provider"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        </div>
      </div>

      {/* Global/Estate Toggle - Only for Super Admins */}
      {isSuperAdmin && (
        <Card className={viewMode === "global" ? "bg-purple-500/5 dark:bg-purple-500/10" : "bg-teal-500/5 dark:bg-teal-500/10"}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Toggle Buttons */}
              <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1 h-10">
                <Button
                  variant={viewMode === "global" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleViewModeChange("global")}
                  className={`transition-all duration-200 ${
                    viewMode === "global"
                      ? "bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                      : ""
                  }`}
                  data-testid="button-provider-view-global"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Global
                </Button>
                <Button
                  variant={viewMode === "estate" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleViewModeChange("estate")}
                  className={`transition-all duration-200 ${
                    viewMode === "estate"
                      ? "bg-teal-500 hover:bg-teal-600 text-white shadow-[0_0_20px_rgba(20,184,166,0.15)]"
                      : ""
                  }`}
                  data-testid="button-provider-view-estate"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Estate
                </Button>
              </div>

              {/* Estate Selector - Shows when Estate mode is active */}
              {viewMode === "estate" && (
                <Select value={selectedEstateId} onValueChange={handleEstateSelect}>
                  <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-provider-estate-filter">
                    <SelectValue placeholder="Select an estate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estates && estates.length > 0 ? (
                      estates.map((estate: any, idx: number) => {
                        const estateId = estate?._id || estate?.id || `estate-${idx}`;
                        return (
                          <SelectItem key={estateId} value={String(estateId)}>
                            <div className="flex flex-col">
                              <span className="font-medium">{estate.name}</span>
                              <span className="text-xs text-muted-foreground">{estate.address}</span>
                            </div>
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>
                        No estates available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}

              {/* Context Badge */}
              <div className="flex-1">
                <Badge
                  variant="outline"
                  className={`text-sm ${
                    viewMode === "global"
                      ? "border-purple-500 text-purple-600 dark:text-purple-400"
                      : "border-teal-500 text-teal-600 dark:text-teal-400"
                  }`}
                >
                  {viewMode === "global" ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                      Viewing all providers globally
                    </>
                  ) : selectedEstateId ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-teal-500 mr-2"></div>
                      Estate: {estates?.find((e: any) => e._id === selectedEstateId)?.name || "Selected"}
                    </>
                  ) : (
                    <>Please select an estate</>
                  )}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search providers by categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-providers"
                />
              </div>
            </div>
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger
                className="w-48"
                data-testid="select-approval-filter"
              >
                <SelectValue placeholder="Filter by approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="true">Approved</SelectItem>
                <SelectItem value="false">Pending Approval</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-48"
                data-testid="select-category-filter"
              >
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger
                className="w-48"
                data-testid="select-company-filter"
              >
                <SelectValue placeholder="Filter by company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
                {companies &&
                  companies
                    .filter((c: any) => !!c?.name)
                    .map((company: any) => (
                      <SelectItem key={company.id || company.name} value={company.name}>
                        {company.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Providers Table */}
      <Card>
        <CardContent className="pt-4 px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider ID</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Total Jobs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProviders?.map((provider: any, idx: number) => {
                const providerId = provider.id || provider._id || `provider-${idx}`;
                return (
                <TableRow
                  key={providerId}
                  data-testid={`row-provider-${providerId}`}
                >
                  <TableCell className="font-medium">
                    {provider.name}
                  </TableCell>
                  <TableCell>
                    {provider.company ? (
                      <span className="text-sm font-medium">{provider.company}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Independent</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {provider.categories
                        ?.slice(0, 2)
                        .map((category: string) => (
                          <Badge
                            key={category}
                            variant="outline"
                            className="text-xs"
                          >
                            {category.replace("_", " ")}
                          </Badge>
                        ))}
                      {provider.categories?.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.categories.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{provider.experience || 0} years</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                      {provider.rating ? Number(provider.rating).toFixed(1) : "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>{provider.totalJobs || 0}</TableCell>
                <TableCell>
                  <Badge
                    variant={provider.isApproved ? "default" : "destructive"}
                  >
                    {provider.isApproved ? "Approved" : "Pending"}
                  </Badge>
                  {/* Show assigned estates */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {memberships
                      ?.filter((m: any) => m.user_id === providerId || m.userId === providerId)
                      ?.map((m: any) => {
                        const estateId = m.estate_id || m.estateId;
                        const estate = estates?.find((e: any) => (e._id || e.id) === estateId);
                        const label = estate?.name || estateId;
                        return (
                          <Badge
                            key={`${providerId}-${estateId}`}
                            variant="outline"
                            className="text-xs flex items-center gap-1"
                          >
                            {label}
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700"
                              onClick={() =>
                                removeEstateMutation.mutate({ providerId, estateId: String(estateId) })
                              }
                              aria-label={`Remove ${label}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Select
                      onValueChange={(value) => assignEstateMutation.mutate({ providerId, estateId: value })}
                      disabled={!estates?.length || assignEstateMutation.isPending}
                    >
                      <SelectTrigger className="w-40" data-testid={`select-assign-estate-${providerId}`}>
                        <SelectValue placeholder="Assign estate" />
                      </SelectTrigger>
                      <SelectContent>
                        {estates?.map((estate: any, estateIdx: number) => {
                          const estateId = estate?._id || estate?.id || `estate-${estateIdx}`;
                          return (
                            <SelectItem key={estateId} value={String(estateId)}>
                              {estate.name || "Unnamed estate"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {!provider.isApproved ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApproval(providerId, true)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-provider-${providerId}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleApproval(providerId, false)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-reject-provider-${providerId}`}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditProvider(provider)}
                        data-testid={`button-edit-provider-${providerId}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPreview(provider)}
                        data-testid={`button-preview-provider-${providerId}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );})}
              {(!filteredProviders || filteredProviders.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-gray-500"
                  >
                    No providers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Provider Dialog (read-only profile, profile-style layout) */}
      <Dialog
        open={!!previewProvider}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewProvider(null);
          }
        }}
      >
        <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-4xl w-[90vw] max-h-[85vh] overflow-auto p-0 bg-transparent border-0 shadow-none">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-purple-700 to-blue-700" />

          <DialogHeader>
            <DialogTitle className="sr-only">Provider Profile</DialogTitle>
            <DialogDescription className="sr-only">
              Overview of provider details from the database.
            </DialogDescription>
          </DialogHeader>

          <div className="relative px-6 pb-6 pt-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-gray-900 shadow-lg">
                    {previewImage ? (
                    <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-gray-200 dark:bg-gray-800">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {previewData.name || "Unnamed Provider"}
                      </h2>
                      <Badge variant={previewProvider?.isApproved ? "default" : "secondary"}>
                        {previewProvider?.isApproved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {previewData.company || "Independent"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {previewProvider?.location || "Location not provided"} Â·{" "}
                      <a
                        href={previewData.email ? `mailto:${previewData.email}` : "#"}
                        className="text-blue-600 dark:text-blue-400"
                      >
                        Contact info
                      </a>
                    </p>
                    <div className="flex items-center gap-4 text-sm text-blue-600 dark:text-blue-400">
                      <span>{previewProvider?.followers || 0} followers</span>
                      <span>{previewProvider?.connections || previewProvider?.totalJobs || 0} jobs</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewProvider(null)}>Close</Button>
                  <Button variant="outline" size="sm">Add note</Button>
                  <Button variant="outline" size="sm">Message</Button>
                  <Button variant="outline" size="sm">More</Button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-gray-50 dark:bg-gray-800/50 p-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Open to work</p>
                  <p className="text-sm text-muted-foreground">
                    {previewData.categories.length > 0
                      ? previewData.categories.map((c) => c.replace("_", " ")).join(", ")
                      : "Categories not specified"}
                  </p>
                </div>
                <div className="rounded-xl border bg-gray-50 dark:bg-gray-800/50 p-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Experience</p>
                  <p className="text-sm text-muted-foreground">
                    {previewData.experience || 0} years Â· {previewData.description || "No summary provided"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="font-medium">{previewData.email || "â€”"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="font-medium">{previewData.phone || "â€”"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-2">Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {previewData.categories.length > 0 ? (
                      previewData.categories.map((c) => (
                        <Badge key={c} variant="outline">
                          {c.replace("_", " ")}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No categories</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Provider Dialog */}
      <Dialog
        open={showAddProvider || !!editingProvider}
        onOpenChange={(open) => {
          setShowAddProvider(open);
          if (!open) {
            setEditingProvider(null);
            providerForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>{editingProvider ? "Edit Service Provider" : "Add New Service Provider"}</DialogTitle>
            <DialogDescription>
              {editingProvider
                ? "Update the provider information below."
                : "Create a new service provider account. New providers start as pending until you approve them."}
            </DialogDescription>
          </DialogHeader>

          <Form {...providerForm}>
            <form
              onSubmit={providerForm.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-3">
                <div>
                  <FormField
                    control={providerForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="First name"
                            {...field}
                            data-testid="input-provider-firstname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={providerForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Last name"
                            {...field}
                            data-testid="input-provider-lastname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={providerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Enter email address"
                            {...field}
                            data-testid="input-provider-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={providerForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter phone number"
                            {...field}
                            data-testid="input-provider-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!editingProvider && (
                  <div>
                    <FormField
                      control={providerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter password"
                              {...field}
                              data-testid="input-provider-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div>
                  <FormField
                    control={providerForm.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Select
                          value={field.value || "independent"}
                          onValueChange={(value) =>
                            field.onChange(value === "independent" ? "" : value)
                          }
                          disabled={isCompaniesLoading}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-provider-company">
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="independent">Independent</SelectItem>
                              {companyOptions.map((company: any) => (
                                <SelectItem key={company.id || company._id || company.name} value={company.id || company._id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormField
                    control={providerForm.control}
                    name="experience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of Experience</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter years of experience"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 0)
                            }
                            data-testid="input-provider-experience"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="sm:col-span-3">
                  <FormField
                    control={providerForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of services offered"
                            {...field}
                            data-testid="textarea-provider-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="sm:col-span-3">
                  <FormField
                    control={providerForm.control}
                    name="categories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Categories *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-between"
                            >
                              {field.value?.length
                                ? `${field.value.length} selected`
                                : "Select categories"}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            sideOffset={0}
                            className="w-[var(--radix-popover-trigger-width)] p-0"
                          >
                            <ScrollArea className="max-h-64 sm:max-h-80 overflow-y-auto p-3">
                              <div className="space-y-2">
                                {categoryOptions.map((category) => {
                                  const categoryValue = category.value;
                                  const label = category.label;
                                  const checked = field.value?.includes(categoryValue);
                                  return (
                                    <div key={categoryValue} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`category-${categoryValue}`}
                                        checked={checked}
                                        onCheckedChange={(checkedState) => {
                                          const isChecked = checkedState === true;
                                          const next = isChecked
                                            ? Array.from(new Set([...(field.value || []), categoryValue]))
                                            : (field.value || []).filter((c) => c !== categoryValue);
                                          field.onChange(next);
                                        }}
                                        data-testid={`checkbox-category-${categoryValue}`}
                                      />
                                      <Label
                                        htmlFor={`category-${categoryValue}`}
                                        className="cursor-pointer"
                                      >
                                        {label}
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                        {field.value?.length ? (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {field.value.map((category: any) => {
                              const label =
                                typeof category === "string"
                                  ? category.replace("_", " ")
                                  : category?.label || category?.value || "Category";
                              const value = typeof category === "string" ? category : category?.value || label;
                              return (
                                <Badge key={value} variant="outline">
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddProvider(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProviderMutation.isPending || updateProviderFormMutation.isPending}
                  data-testid="button-submit-provider"
                >
                  {createProviderMutation.isPending || updateProviderFormMutation.isPending
                    ? "Saving..."
                    : editingProvider
                      ? "Save changes"
                      : "Create Provider"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Categories Management Component
const CategoriesManagement = () => {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    icon: "",
    scope: "estate",
    tag: DEFAULT_CATEGORY_TAG,
  });
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const BASE_EMOJI_OPTIONS = [
    "🔧", "🧹", "🛠️", "⚡", "🚰", "🔌", "🔦", "🧑‍🔧", "🏠", "🧰",
    "🚿", "✨", "🧼", "🧽", "🪣", "🪜", "🔨", "⛏️",
  ];

  const SERVICE_CATEGORY_EMOJI = [
    "🛡️", "🚶‍♂️", "🚧", "🎥", "🚨", "👮‍♂️", "🚗", "🚌", "🚕", "🚙",
    "🚛", "⚙️", "💡", "💧", "🌊", "🗑️", "🗺️", "🧾", "🌳", "🌾",
    "🌬️", "📋", "🪚", "🔑", "🎨", "📥", "🧱", "🏃‍♂️", "🚑", "🩺",
    "🧘‍♂️", "👨‍⚕️", "👨‍👩‍👧‍👦", "🚘", "🌱", "🏊‍♂️", "🥦", "🧺", "🐱", "🥕",
    "🦴", "🎉", "⚽", "🎊", "🎬", "🏊‍♀️", "🎮", "🎵", "🎸", "🎹",
    "📞", "🎭", "📚", "🫎", "🚙", "📅", "🏠", "💬", "🎓", "📲",
    "🎪", "⚙️", "🔐", "🎯", "🔒", "🔓", "🎈", "🎀", "📍", "✅",
  ];

  const emojiOptions = Array.from(
    new Set([
      ...BASE_EMOJI_OPTIONS,
      ...SERVICE_CATEGORY_EMOJI,
      ...EMOJI_OPTIONS.map((o) => o.value),
    ]),
  );

  const emojiLabelMap = new Map(EMOJI_OPTIONS.map((o) => [o.value, o.label]));

  const { user } = useAdminAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.globalRole === "super_admin";

  const { data: categories, isLoading } = useQuery({
    queryKey: ["/api/admin/categories", { scope: scopeFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (scopeFilter !== "all") params.set("scope", scopeFilter);
      return adminApiRequest(
        "GET",
        `/api/admin/categories?${params.toString()}`,
      );
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (categoryData: any) =>
      adminApiRequest("POST", "/api/admin/categories", categoryData),
      onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      // Also invalidate public category lists so resident views refresh
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Category created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating category",
        description: error.response?.data?.error || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      adminApiRequest("PATCH", `/api/admin/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      // Ensure resident/public lists refresh for updates
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingCategory(null);
      resetForm();
      toast({ title: "Category updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating category",
        description: error.response?.data?.error || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) =>
      adminApiRequest("DELETE", `/api/admin/categories/${categoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      // Delete should also refresh public category lists
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting category",
        description: error.response?.data?.error || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const toggleCategoryStatusMutation = useMutation({
    mutationFn: ({
      categoryId,
      newStatus,
    }: {
      categoryId: string;
      newStatus: boolean;
    }) =>
      adminApiRequest("PATCH", `/api/admin/categories/${categoryId}`, {
        isActive: newStatus,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({
        title: `Category ${variables.newStatus ? "activated" : "deactivated"}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating category status",
        description:
          error.response?.data?.error || "Failed to update category status",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const categoryData = {
      ...formData,
      key: formData.key || formData.name.toLowerCase().replace(/\s+/g, "_"),
      tag: formData.tag || DEFAULT_CATEGORY_TAG,
    };
    createCategoryMutation.mutate(categoryData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      const categoryId = editingCategory._id || editingCategory.id;
      if (!categoryId) {
        toast({ title: "Category id missing", variant: "destructive" });
        return;
      }
      updateCategoryMutation.mutate({ id: categoryId, ...formData });
    }
  };

  const handleDeleteCategory = (categoryId: string | undefined) => {
    if (!categoryId) {
      toast({ title: "Category id missing", variant: "destructive" });
      return;
    }
    if (
      confirm(
        "Are you sure you want to delete this category? This action cannot be undone.",
      )
    ) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  const handleToggleCategoryStatus = (
    categoryId: string | undefined,
    currentStatus: boolean,
  ) => {
    if (!categoryId) {
      toast({ title: "Category id missing", variant: "destructive" });
      return;
    }
    toggleCategoryStatusMutation.mutate({
      categoryId,
      newStatus: !currentStatus,
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      key: "",
      description: "",
      icon: "",
      scope: "estate",
      tag: DEFAULT_CATEGORY_TAG,
    });
  };

  const handleOpenEditDialog = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || "",
      key: category.key || "",
      description: category.description || "",
      icon: category.icon || "",
      scope: category.scope || "estate",
      tag: category.tag || DEFAULT_CATEGORY_TAG,
    });
  };

  const filteredCategories =
    categories?.filter((category: any) => {
      return (
        category.name?.toLowerCase().includes(search.toLowerCase()) ||
        category.key?.toLowerCase().includes(search.toLowerCase())
      );
    }) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Service Categories
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage global and estate-specific service categories
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="mt-4 sm:mt-0"
          data-testid="button-create-category"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
                data-testid="input-search-categories"
              />
            </div>
            <Select value={scopeFilter} onValueChange={setScopeFilter}>
              <SelectTrigger
                className="w-full sm:w-48"
                data-testid="select-scope-filter"
              >
                <SelectValue placeholder="Filter by scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scopes</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="estate">Estate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.map((category: any) => (
                <TableRow
                  key={category._id || category.id}
                  data-testid={`row-category-${category._id || category.id}`}
                >
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {category.icon && (
                        <span className="text-lg">{category.icon}</span>
                      )}
                      <span
                        className="font-medium"
                        data-testid={`text-category-name-${category._id || category.id}`}
                      >
                        {category.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {category.key}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        category.scope === "global" ? "default" : "secondary"
                      }
                    >
                      {category.scope}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs uppercase tracking-wide">
                      {category.tag || "Not tagged"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {category.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={category.isActive ? "default" : "secondary"}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(category)}
                        data-testid={`button-edit-category-${category._id || category.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category._id || category.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-category-${category._id || category.id}`}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleToggleCategoryStatus(
                            category._id || category.id,
                            category.isActive,
                          )
                        }
                        className={category.isActive ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}
                        disabled={toggleCategoryStatusMutation.isPending}
                        data-testid={`button-toggle-category-${category._id || category.id}`}
                        title={category.isActive ? "Deactivate category" : "Activate category"}
                      >
                        {category.isActive ? (
                          <ShieldOff className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Category Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[60vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new service category for{" "}
              {isSuperAdmin
                ? "global use or estate-specific use"
                : "your estate"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Category name"
                required
                data-testid="input-category-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Key</label>
              <Input
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
                placeholder="category_key (auto-generated if empty)"
                data-testid="input-category-key"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
                data-testid="input-category-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Icon</label>
              <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Input
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    onFocus={() => setIconPickerOpen(true)}
                    placeholder="ðŸ”§ (optional emoji icon)"
                    data-testid="input-category-icon"
                  />
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  className="w-[min(360px,calc(100vw-3rem))]"
                >
                  <div className="mb-2">
                    <Input
                      placeholder="Search icons"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      data-testid="input-icon-search"
                    />
                  </div>
                  <div className="h-[200px] overflow-auto">
                    <div className="grid grid-cols-6 gap-2 text-left p-1">
                      {(emojiOptions
                        .filter((val) => {
                          const label = (emojiLabelMap.get(val) || "").toLowerCase();
                          const q = iconSearch.trim().toLowerCase();
                          if (!q) return true;
                          return label.includes(q) || val.includes(q);
                        })
                        .map((emoji, idx) => (
                          <button
                            key={`${emoji}-${idx}`}
                            type="button"
                            className="text-xl p-2 rounded hover:bg-muted"
                            onClick={() => {
                              setFormData({ ...formData, icon: emoji });
                              setIconPickerOpen(false);
                              setIconSearch("");
                            }}
                          >
                            {emoji}
                          </button>
                        )))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-sm font-medium">Scope</label>
                <Select
                  value={formData.scope}
                  onValueChange={(value) =>
                    setFormData({ ...formData, scope: value })
                  }
                >
                  <SelectTrigger data-testid="select-category-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (all estates)</SelectItem>
                    <SelectItem value="estate">Estate specific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Tag</label>
              <Select
                value={formData.tag}
                onValueChange={(value) =>
                  setFormData({ ...formData, tag: value })
                }
              >
                <SelectTrigger data-testid="select-category-tag">
                  <SelectValue placeholder="Select a tag" />
                </SelectTrigger>
                <SelectContent className="max-h-60" sideOffset={5} align="start">
                  {CATEGORY_TAG_OPTIONS.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCategoryMutation.isPending}
                data-testid="button-submit-create-category"
              >
                {createCategoryMutation.isPending
                  ? "Creating..."
                  : "Create Category"}
              </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={!!editingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCategory(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="w-[60vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update the category details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Category name"
                required
                data-testid="input-edit-category-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
                data-testid="input-edit-category-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Icon</label>
              <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Input
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    onFocus={() => setIconPickerOpen(true)}
                    placeholder="ðŸ”§ (optional emoji icon)"
                    data-testid="input-edit-category-icon"
                  />
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  className="w-[min(360px,calc(100vw-3rem))]"
                >
                  <div className="mb-2">
                    <Input
                      placeholder="Search icons"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      data-testid="input-icon-search-edit"
                    />
                  </div>
                  <div className="h-[250px] overflow-auto">
                    <div className="grid grid-cols-6 gap-2 text-left p-1">
                      {(emojiOptions
                        .filter((val) => {
                          const label = (emojiLabelMap.get(val) || "").toLowerCase();
                          const q = iconSearch.trim().toLowerCase();
                          if (!q) return true;
                          return label.includes(q) || val.includes(q);
                        })
                        .map((emoji, idx) => (
                          <button
                            key={`${emoji}-${idx}`}
                            type="button"
                            className="text-xl p-2 rounded hover:bg-muted"
                            onClick={() => {
                              setFormData({ ...formData, icon: emoji });
                              setIconPickerOpen(false);
                              setIconSearch("");
                            }}
                          >
                            {emoji}
                          </button>
                        )))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingCategory(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateCategoryMutation.isPending}
                data-testid="button-submit-edit-category"
              >
                {updateCategoryMutation.isPending
                  ? "Updating..."
                  : "Update Category"}
              </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Marketplace Management Component
const MarketplaceManagement = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IMarketplaceItem | null>(null);

  const { user } = useAdminAuth();
  const { toast } = useToast();

  // Create form with proper Zod validation
  const createForm = useForm<CreateMarketplaceItemInput>({
    resolver: zodResolver(createMarketplaceItemSchema),
    defaultValues: {
      vendorId: "",
      name: "",
      description: "",
      price: 0,
      currency: "NGN",
      category: "",
      subcategory: "",
      stock: 0,
      images: [],
    },
  });

  // Edit form with proper Zod validation
  const editForm = useForm<UpdateMarketplaceItemInput>({
    resolver: zodResolver(updateMarketplaceItemSchema),
    defaultValues: {
      vendorId: "",
      name: "",
      description: "",
      price: 0,
      currency: "NGN",
      category: "",
      subcategory: "",
      stock: 0,
      images: [],
    },
  });

  // Use hierarchical query keys and default fetcher
  const { data: items, isLoading } = useQuery({
    queryKey: [
      "${import.meta.env.VITE_API_URL}/api/admin/marketplace",
      { category: categoryFilter, vendor: vendorFilter, search },
    ],
    queryFn: () => adminApiRequest("GET", "/api/admin/marketplace"),
    enabled: true,
  });

  // Get categories and vendors for filtering
  const { data: categories } = useQuery({
    queryKey: ["/api/admin/categories"],
    queryFn: () => adminApiRequest("GET", "/api/admin/categories"),
    enabled: true,
  });

  const { data: vendors } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/providers"],
    queryFn: () => adminApiRequest("GET", "/api/admin/providers"),
    enabled: true,
  });

  // Type-safe array access with fallback
  const categoriesArray = Array.isArray(categories) ? categories : [];
  const vendorsArray = Array.isArray(vendors) ? vendors : [];

  const createItemMutation = useMutation({
    mutationFn: (itemData: CreateMarketplaceItemInput) =>
      adminApiRequest("POST", "/api/admin/marketplace", itemData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/marketplace"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Marketplace item created successfully" });
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast({
        title: "Error creating marketplace item",
        description: error.response?.data?.error || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & UpdateMarketplaceItemInput) =>
      adminApiRequest("PATCH", `/api/admin/marketplace/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace"] });
      setEditingItem(null);
      editForm.reset();
      toast({ title: "Marketplace item updated successfully" });
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast({
        title: "Error updating marketplace item",
        description: error.response?.data?.error || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      adminApiRequest("DELETE", `/api/admin/marketplace/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace"] });
      toast({ title: "Marketplace item deleted successfully" });
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast({
        title: "Error deleting marketplace item",
        description: error.response?.data?.error || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: CreateMarketplaceItemInput) => {
    createItemMutation.mutate(data);
  };

  const handleEditSubmit = (data: UpdateMarketplaceItemInput) => {
    if (editingItem) {
      const itemId = editingItem._id || editingItem.id;
      if (!itemId) {
        toast({
          title: "Unable to update item",
          description: "Missing item identifier for this record",
          variant: "destructive",
        });
        return;
      }

      updateItemMutation.mutate({
        id: itemId,
        ...data,
      });
    }
  };

  const handleDeleteItem = (itemId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this marketplace item? This action cannot be undone.",
      )
    ) {
      deleteItemMutation.mutate(itemId);
    }
  };

  const handleOpenEditDialog = (item: IMarketplaceItem) => {
    setEditingItem(item);
    editForm.reset({
      vendorId: item.vendorId || "",
      name: item.name || "",
      description: item.description || "",
      price: item.price || 0,
      currency: item.currency || "NGN",
      category: item.category || "",
      subcategory: item.subcategory || "",
      stock: item.stock || 0,
      images: item.images || [],
    });
  };

  // Type-safe items filtering with fallback
  const itemsArray = Array.isArray(items) ? (items as IMarketplaceItem[]) : [];
  const filteredItems = itemsArray.filter((item: IMarketplaceItem) => {
    return (
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Marketplace Management
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage marketplace items for food runs and groceries
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="mt-4 sm:mt-0"
          data-testid="button-create-marketplace-item"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
                data-testid="input-search-items"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-full lg:w-48"
                data-testid="select-category-filter"
              >
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesArray.map((category: any) => (
                  <SelectItem
                    key={category._id || category.id || category}
                    value={category.key || category.name || category}
                  >
                    {category.name || category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger
                className="w-full lg:w-48"
                data-testid="select-vendor-filter"
              >
                <SelectValue placeholder="Filter by vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendorsArray.map((vendor: any) => (
                  <SelectItem
                    key={vendor._id || vendor.id || vendor}
                    value={vendor._id || vendor.id || vendor}
                  >
                    {vendor.name || vendor.email || vendor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item: any) => (
                <TableRow key={item._id} data-testid={`row-item-${item._id}`}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      {item.images?.[0] && (
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div>
                        <div
                          className="font-medium"
                          data-testid={`text-item-name-${item._id}`}
                        >
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-sm text-gray-500 max-w-xs truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <Badge variant="outline">{item.category}</Badge>
                      {item.subcategory && (
                        <div className="text-xs text-gray-500 mt-1">
                          {item.subcategory}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {item.currency} {item.price?.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.stock > 0 ? "default" : "secondary"}>
                      {item.stock} units
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {item.vendorId}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(item)}
                        data-testid={`button-edit-item-${item._id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item._id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-item-${item._id}`}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Item Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[60vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Create New Marketplace Item</DialogTitle>
            <DialogDescription>
              Add a new item to the marketplace for residents to purchase
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(handleCreateSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="vendor123"
                          data-testid="input-vendor-id"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="local_food, grocery"
                          data-testid="input-category"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Fresh Tomatoes (5kg)"
                        data-testid="input-item-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Fresh tomatoes from local farms"
                        data-testid="input-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="2500"
                          data-testid="input-price"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="50"
                          data-testid="input-stock"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="vegetables, fruits"
                        data-testid="input-subcategory"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    createForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createItemMutation.isPending}
                  data-testid="button-submit-create-item"
                >
                  {createItemMutation.isPending ? "Creating..." : "Create Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            editForm.reset();
          }
        }}
      >
        <DialogContent className="w-[60vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Edit Marketplace Item</DialogTitle>
            <DialogDescription>Update the item details</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor ID</FormLabel>
                      <FormControl>
                        <Input data-testid="input-edit-vendor-id" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input data-testid="input-edit-category" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-item-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          data-testid="input-edit-price"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="input-edit-stock"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory (Optional)</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-subcategory" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingItem(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateItemMutation.isPending}
                  data-testid="button-submit-edit-item"
                >
                  {updateItemMutation.isPending ? "Updating..." : "Update Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Recent Activity Component
const RecentActivity = () => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);

  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/admin/audit-logs", { limit, search, dateFrom, dateTo }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      params.append("limit", limit.toString());

      const queryString = params.toString();
      return adminApiRequest(
        "GET",
        `/api/admin/audit-logs${queryString ? "?" + queryString : ""}`,
      );
    },
  });

  const exportToCsv = () => {
    if (!activities || activities.length === 0) return;

    const headers = ["Date", "User", "Action", "Target", "Details"];
    const csvContent = [
      headers.join(","),
      ...activities.map((activity: any) =>
        [
          new Date(activity.createdAt).toLocaleString(),
          activity.user?.name || "System",
          activity.action || "",
          activity.target || "",
          activity.details?.replace(/,/g, ";") || "",
        ]
          .map((field) => `"${field}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `activity-logs-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActivityIcon = (action: string) => {
    switch (action?.toLowerCase()) {
      case "create":
      case "register":
        return <Plus className="w-4 h-4 text-green-600" />;
      case "update":
      case "edit":
        return <Edit className="w-4 h-4 text-blue-600" />;
      case "delete":
      case "remove":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "approve":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "reject":
        return <XCircle className="w-4 h-4 text-orange-600" />;
      case "login":
        return <LogOut className="w-4 h-4 text-purple-600" />;
      default:
        return <ClipboardList className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityBgColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case "create":
      case "register":
      case "approve":
        return "bg-green-100";
      case "update":
      case "edit":
        return "bg-blue-100";
      case "delete":
      case "remove":
        return "bg-red-100";
      case "reject":
        return "bg-orange-100";
      case "login":
        return "bg-purple-100";
      default:
        return "bg-gray-100";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              disabled={!activities || activities.length === 0}
              data-testid="button-export-activity"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Label htmlFor="dateFrom" className="text-sm">
              From Date
            </Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1"
              data-testid="input-date-from"
            />
          </div>
          <div>
            <Label htmlFor="dateTo" className="text-sm">
              To Date
            </Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1"
              data-testid="input-date-to"
            />
          </div>
          <div>
            <Label htmlFor="activitySearch" className="text-sm">
              Search
            </Label>
            <Input
              id="activitySearch"
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1"
              data-testid="input-search-activity"
            />
          </div>
          <div>
            <Label htmlFor="limit" className="text-sm">
              Show Records
            </Label>
            <Select
              value={limit.toString()}
              onValueChange={(value) => setLimit(Number(value))}
            >
              <SelectTrigger
                className="mt-1"
                data-testid="select-activity-limit"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Activity List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-4 animate-pulse"
                >
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            activities.map((activity: any, index: number) => (
              <div
                key={activity._id || index}
                className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg"
              >
                <div
                  className={`w-8 h-8 ${getActivityBgColor(activity.action)} rounded-full flex items-center justify-center`}
                >
                  {getActivityIcon(activity.action)}
                </div>
                <div className="flex-1">
                  <p
                    className="text-sm font-medium"
                    data-testid={`activity-action-${index}`}
                  >
                    {activity.action || "Unknown action"}{" "}
                    {activity.target && `- ${activity.target}`}
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid={`activity-details-${index}`}
                  >
                    {activity.user?.name || "System"} â€¢{" "}
                    {activity.details || "No details"} â€¢{" "}
                    {activity.createdAt
                      ? new Date(activity.createdAt).toLocaleString()
                      : "Unknown time"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No recent activity found</p>
              {(dateFrom || dateTo || search) && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setSearch("");
                  }}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// PostgreSQL Bridge Stats Component - Shows data from resident/provider system
const PostgreSQLBridgeStats = () => {
  const { data: bridgeStats, isLoading, refetch } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/bridge/stats"],
    queryFn: () => adminApiRequest("GET", "/api/admin/bridge/stats"),
    refetchInterval: 30_000, // Refresh every 30 seconds to ensure fresh data
  });
  const { data: dbHealth } = useQuery({
    queryKey: ["/api/admin/health/database"],
    queryFn: () => adminApiRequest("GET", "/api/admin/health/database"),
    enabled: false, // Only fetch on demand
  });

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Resident & Provider System Data
          </h3>
          <Badge variant="secondary">PostgreSQL</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const bridgeStatCards = [
    {
      title: "Total Residents",
      value: bridgeStats?.users?.totalResidents || 0,
      icon: Users,
      description: "Active residents in the system",
      color: "text-blue-600",
    },
    {
      title: "Service Providers",
      value: bridgeStats?.users?.totalProviders || 0,
      icon: UserCheck,
      description: "Registered service providers",
      color: "text-green-600",
    },
    {
      title: "Service Requests",
      value: bridgeStats?.serviceRequests?.total || 0,
      icon: ClipboardList,
      description: "Total service requests",
      color: "text-purple-600",
    },
    {
      title: "Pending Approvals",
      value: bridgeStats?.users?.pendingProviders || 0,
      icon: AlertTriangle,
      description: "Providers awaiting approval",
      color: "text-orange-600",
    },
  ];

  const requestStatusData = bridgeStats?.serviceRequests
    ? [
        {
          label: "Pending",
          value: bridgeStats.serviceRequests.pending,
          color: "bg-yellow-500",
        },
        {
          label: "Pending Inspection",
          value: bridgeStats.serviceRequests.pendingInspection - 0,
          color: "bg-orange-500",
        },
        {
          label: "Assigned",
          value: bridgeStats.serviceRequests.assigned - 0,
          color: "bg-indigo-500",
        },
        {
          label: "In Progress",
          value: bridgeStats.serviceRequests.inProgress,
          color: "bg-blue-500",
        },
        {
          label: "Completed",
          value: bridgeStats.serviceRequests.completed,
          color: "bg-green-500",
        },
        {
          label: "Cancelled",
          value: bridgeStats.serviceRequests.cancelled,
          color: "bg-red-500",
        },
      ]
    : [];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Resident & Provider System Data
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">PostgreSQL</Badge>
          <Badge variant="outline">Live Data</Badge>
          {bridgeStats?.source && (
            <Badge variant="outline" className="text-xs">
              {bridgeStats.source.toUpperCase()} â€¢ {new Date(bridgeStats.timestamp).toLocaleTimeString()}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Bridge Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {bridgeStatCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p
                      className={`text-2xl font-bold ${stat.color}`}
                      data-testid={`bridge-stat-${stat.title.toLowerCase().replace(" ", "-")}`}
                    >
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.description}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Service Request Status Breakdown */}
      {requestStatusData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Service Request Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {requestStatusData.map((status, index) => (
                <div key={index} className="text-center">
                  <div
                    className={`w-full h-2 ${status.color} rounded-full mb-2`}
                  ></div>
                  <p className="text-sm font-medium">{status.label}</p>
                  <p className="text-lg font-bold">{status.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const EstatePerformanceCard = () => {
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/dashboard/estate-performance"],
    queryFn: () => adminApiRequest("GET", "/api/admin/dashboard/estate-performance"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estate Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
        ) : !rows || rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No estate data available.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row: any) => (
              <div key={row.estateId} className="flex justify-between items-center">
                <span className="text-sm font-medium">{row.name}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-green-500 rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, Number(row.completionRate - 0)))}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">{Number(row.completionRate - 0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Dashboard Stats Component
const DashboardStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: () => adminApiRequest("GET", "/api/admin/dashboard/stats"),
  });
  const { data: bridgeStats } = useQuery({
    queryKey: ["/api/admin/bridge/stats"],
    queryFn: () => adminApiRequest("GET", "/api/admin/bridge/stats"),
    staleTime: 30_000,
  });
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users/all"],
    queryFn: () => adminApiRequest("GET", "/api/admin/users/all"),
  });
  const { data: allEstates = [] } = useQuery({
    queryKey: ["/api/admin/estates"],
    queryFn: () => adminApiRequest("GET", "/api/admin/estates"),
  });

  const totalProviders =
    (stats?.totalProviders ?? 0) - (bridgeStats?.users?.totalProviders ?? 0);
  const totalResidents =
    (stats?.totalResidents ?? 0) - (bridgeStats?.users?.totalResidents ?? 0);
  const pendingApprovals =
    (stats?.pendingApprovals ?? 0) - (bridgeStats?.users?.pendingProviders ?? 0);
  const totalRequests =
    (stats?.totalRequests ?? 0) - (bridgeStats?.serviceRequests?.total ?? 0);
  const activeRequests =
    (stats?.activeRequests ?? 0) -
    (bridgeStats?.serviceRequests?.pending ?? 0);
  const totalUsers = stats?.totalUsers ?? 0;
  const activeEstatesCount = Array.isArray(allEstates) ? allEstates.length : (stats?.totalEstates ?? 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: totalUsers,
      icon: Users,
      change: "+0%",
    },
    {
      title: "Active Estates",
      value: activeEstatesCount,
      icon: Building2,
      change: "+0%",
    },
    {
      title: "Total Revenue",
      value: `NGN ${(stats?.totalRevenue - 0).toLocaleString()}`,
      icon: DollarSign,
      change: "+0%",
    },
    {
      title: "Active Requests",
      value: activeRequests,
      icon: TrendingUp,
      change: "+0%",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid={`stat-${stat.title.toLowerCase().replace(" ", "-")}`}
                  >
                    {stat.value}
                  </p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center mt-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span>{stat.change}</span>
                <span className="ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Main Admin Dashboard Component
export default function AdminSuperDashboard() {
  const { user, token, sessionChecked, selectedEstateId, setSelectedEstateId } = useAdminAuth();
  const [location, setLocation] = useLocation();
  const activeTab = (() => {
    if (!location.startsWith("/admin-dashboard")) return "dashboard";
    const pathPart = location.split("/")[2] || "dashboard";
    return String(pathPart).split("?")[0].split("#")[0] || "dashboard";
  })();
  const setActiveTab = (tab: string) => setLocation(`/admin-dashboard/${tab}`);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const isSuperAdmin = user?.globalRole === "super_admin";
  const { data: providerRequests = [] } = useQuery({
    queryKey: ["admin/provider-requests"],
    queryFn: () => adminApiRequest("GET", "/api/admin/provider-requests"),
    enabled: isSuperAdmin,
    refetchInterval: 15_000,
    staleTime: 15_000,
  });
  const { data: estateList = [] } = useQuery({
    queryKey: ["admin-estates"],
    queryFn: () => adminApiRequest("GET", "/api/admin/estates"),
    enabled: Boolean(user),
  });
  const { data: orderStats } = useQuery({
    queryKey: ["admin-orders-analytics"],
    queryFn: () => adminApiRequest("GET", "/api/admin/orders/analytics/stats"),
    enabled: isSuperAdmin,
  });
  const { data: categoriesList = [] } = useQuery({
    queryKey: ["/api/admin/categories"],
    queryFn: () => adminApiRequest("GET", "/api/admin/categories"),
    enabled: isSuperAdmin,
  });
  useEffect(() => {
    if (!sessionChecked || !user || selectedEstateId) return;
    if (!Array.isArray(estateList) || estateList.length === 0) return;
    const firstEstate = estateList[0];
    const estateId = firstEstate?._id || firstEstate?.id || firstEstate?.slug;
    if (estateId) {
      setSelectedEstateId(String(estateId));
    }
  }, [estateList, selectedEstateId, sessionChecked, user]);

  // Listen for service request SSE events to keep stats fresh
  useEffect(() => {
    if (!isSuperAdmin) return;

    const setupSSE = () => {
      try {
        const es = new EventSource("/api/service-requests/stream");
        
        es.addEventListener("service-request", (event: Event) => {
          try {
            const evt = event as any;
            const data = JSON.parse(evt.data);
            if (data.type === "created" || data.type === "updated" || data.type === "assigned") {
              // Invalidate bridge stats to refresh counts
              queryClient.invalidateQueries({ queryKey: ["/api/admin/bridge/stats"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/bridge/service-requests"] });
            }
          } catch (e) {
            // ignore parse errors
          }
        });

        es.addEventListener("error", () => {
          es.close();
        });

        return () => {
          es.close();
        };
      } catch (e) {
        // EventSource not available or failed
        return undefined;
      }
    };

    const cleanup = setupSSE();
    return cleanup;
  }, [isSuperAdmin]);

  const { toast } = useToast();
  const notificationCount = providerRequests.length;
  const acceptRequestMutation = useMutation({
    mutationFn: (providerId: string) =>
      adminApiRequest("POST", `/api/admin/providers/${providerId}/approve`),
    onSuccess: async (_data, providerId) => {
      queryClient.setQueryData(["admin/provider-requests"], (old: any[] | undefined) =>
        old?.filter((request) => request.providerId !== providerId),
      );
      await queryClient.invalidateQueries({ queryKey: ["admin/provider-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      toast({ title: "Provider approved" });
    },
    onError: (error: any) => {
      toast({
        title: "Error approving provider",
        description:
          error.response?.data?.error || "Failed to approve provider",
        variant: "destructive",
      });
    },
  });
  const declineRequestMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      adminApiRequest("POST", `/api/admin/provider-requests/${requestId}/decline`, { reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin/provider-requests"] });
      toast({ title: "Provider declined" });
    },
    onError: (error: any) => {
      toast({
        title: "Error declining provider",
        description:
          error.response?.data?.error || "Failed to decline provider",
        variant: "destructive",
      });
    },
  });
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [selectedRequestForDecline, setSelectedRequestForDecline] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState("");
  const handleConfirmDecline = () => {
    if (!selectedRequestForDecline?.providerId) {
      toast({
        title: "Provider not registered",
        description: "No user record found for this request yet.",
        variant: "destructive",
      });
      setDeclineDialogOpen(false);
      return;
    }
    declineRequestMutation.mutate({
      requestId: selectedRequestForDecline.id,
      reason: declineReason || "No reason provided",
    });
    setDeclineDialogOpen(false);
    setSelectedRequestForDecline(null);
    setDeclineReason("");
  };
  const handleAcceptRequest = (request: any) => {
    if (!request.providerId) {
      toast({
        title: "Provider not registered",
        description: "No user record found for this request yet.",
        variant: "destructive",
      });
      return;
    }
    acceptRequestMutation.mutate(request.providerId);
  };
  const handleDeclineRequest = (request: any) => {
    setSelectedRequestForDecline(request);
    setDeclineReason("");
    setRequestDialogOpen(false);
    setTimeout(() => setDeclineDialogOpen(true), 400);
  };
  const handleInvestigateRequest = (request: any) => {
    toast({
      title: "Investigate request",
      description: `${request.name || "Provider"}'s details are available in Provider Management.`,
    });
  };

  const handleEstateSelection = (estateId: string | null) => {
    const normalized = estateId || null;
    setSelectedEstateId(normalized);
    setCurrentEstate(normalized);
  };
  useEffect(() => {
    if (location === "/admin-dashboard" || location === "/admin-dashboard/") {
      setLocation("/admin-dashboard/dashboard")
    }
  }, [location, setLocation]);

  // Block until we know whether a session user exists (prevents flicker)
  if (!sessionChecked && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300">Loading session...</p>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <AdminLogin />;
  }

  return (
    
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="flex h-full">
        {/* Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />

        {/* Main Content */}
        <div className="flex-1 lg:ml-0 h-full overflow-y-auto">
          {/* Mobile Header */}
          <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu className="w-4 h-4" />
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
              <div className="flex items-center space-x-2">
                {isSuperAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRequestDialogOpen(true)}
                      aria-label="View provider requests"
                    >
                      <Bell className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation("/admin-dashboard/settings")}
                      aria-label="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="hidden lg:flex justify-end bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
                <div className="flex items-center space-x-2">
                  <Link href="/company-registration">
                    <Button variant="secondary" size="sm" className="px-2 sm:px-3 h-8 flex items-center">
                      <Building2 className="w-4 h-4" />
                      <span className="ml-2 hidden sm:inline">Register a business</span>
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2 sm:px-3 h-8 flex items-center"
                    onClick={() => setLocation("/admin-dashboard/providers")}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="ml-2 hidden sm:inline">Add provider</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRequestDialogOpen(true)}
                    aria-label="View provider requests"
                    className="h-8 w-8 p-0"
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/admin-dashboard/settings")}
                    aria-label="Settings"
                    className="h-8 w-8 p-0"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  {notificationCount > 0 && (
                    <span className="ml-2 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                      {notificationCount > 9 ? "9+" : notificationCount} new request
                      {notificationCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
          )}

          {isSuperAdmin && (
            <>
            <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
              <DialogContent className="max-w-3xl w-[90vw]">
                <DialogHeader>
                  <DialogTitle>Provider requests</DialogTitle>
                  <DialogDescription>
                    Review company dashboard submissions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-4">
                  {providerRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No pending provider requests.
                    </p>
                  ) : (
                    providerRequests.map((request: any) => (
                      <div
                        key={request.id}
                        className="rounded-xl border border-border bg-white dark:bg-gray-900 p-4 shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {request.name || "Unknown name"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {request.email}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {request.description || "No description provided"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            Received{" "}
                            {request.createdAt
                              ? new Date(request.createdAt).toLocaleString()
                              : "â€”"}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAcceptRequest(request)}
                            disabled={!request.providerId || acceptRequestMutation.isPending}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInvestigateRequest(request)}
                          >
                            Investigate
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeclineRequest(request)}
                            disabled={declineRequestMutation.isPending}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setRequestDialogOpen(false)}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={declineDialogOpen} onOpenChange={(open) => {
              setDeclineDialogOpen(open);
              if (!open) {
                setSelectedRequestForDecline(null);
                setDeclineReason("");
              }
            }}>
              <DialogContent className="w-[60vw] max-w-[95vw]">
                <DialogHeader>
                  <DialogTitle>Decline provider request</DialogTitle>
                  <DialogDescription>
                    Provide a reason before declining.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedRequestForDecline?.name || "Provider"} â€“ {selectedRequestForDecline?.email}
                  </p>
                  <Textarea
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    placeholder="Explain why this provider is being declined"
                    rows={4}
                  />
                </div>
                <DialogFooter className="justify-end">
                  <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmDecline}
                    disabled={declineRequestMutation.isPending}
                  >
                    Decline
                  </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
            <Dialog open={declineDialogOpen} onOpenChange={(open) => {
              setDeclineDialogOpen(open);
              if (!open) {
                setSelectedRequestForDecline(null);
                setDeclineReason("");
              }
            }}>
              <DialogContent className="w-[60vw] max-w-[95vw]">
                <DialogHeader>
                  <DialogTitle>Decline provider request</DialogTitle>
                  <DialogDescription>
                    Provide a reason before declining.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedRequestForDecline?.name || "Provider"} â€“ {selectedRequestForDecline?.email}
                  </p>
                  <Textarea
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    placeholder="Explain why this provider is being declined"
                    rows={4}
                  />
                </div>
                <DialogFooter className="justify-end">
                  <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmDecline}
                    disabled={declineRequestMutation.isPending}
                  >
                    Decline
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}

          {/* Page Content */}
          <div className="py-6 px-0">
            {activeTab === "dashboard" && (
              <div>
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Dashboard Overview
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Welcome back, {user.name}! Here's what's happening across
                    your platform.
                  </p>
                </div>

                <DashboardStats />

                <PostgreSQLBridgeStats />

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RecentActivity />

                  <EstatePerformanceCard />
                </div>
              </div>
            )}

            {activeTab === "users" && <UsersManagement />}
            {activeTab === "estates" && <EstatesManagement />}
            {activeTab === "providers" && <ProvidersManagement />}
            {activeTab === "companies" && <CompaniesManagement categoriesList={categoriesList} />}
            {activeTab === "item-categories" && <ItemCategoriesPage />}
            {activeTab === "stores" && <StoresManagement />}
            {activeTab === "categories" && <CategoriesManagement />}
            {activeTab === "orders" && <OrdersManagement />}
            {activeTab === "ai-conversations" && <AiConversationsPanel />}
            {activeTab === "ai-conversation-flow" && <AiConversationFlowPanel />}
            {activeTab === "ai-prepared-requests" && <AiPreparedRequestsPanel />}
            {activeTab === "pricing-rules" && <PricingRulesPanel />}
            {activeTab === "provider-matching" && <ProviderMatchingPanel />}
            {activeTab === "analytics" && <AnalyticsPanel orderStats={orderStats} />}
            {["requests", "artisanRequests"].includes(activeTab) && (
              <ArtisanRequestsPanel
                selectedEstateId={selectedEstateId}
                estates={estateList}
                onSelectEstate={handleEstateSelection}
              />
            )}

            {/* Removed generic under-development placeholder section */}
          </div>
        </div>
      </div>
    </div>
    
  );
}

// Estates Management Component
const EstatesManagement = () => {
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEstate, setEditingEstate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    address: "",
    settings: {
      servicesEnabled: [],
      marketplaceEnabled: true,
      paymentMethods: [],
      deliveryRules: {},
    },
  });

  // Simple slugify helper
  const slugify = (s: string) =>
    s
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  // Keep slug in sync with name when creating/editing
  useEffect(() => {
    setFormData((prev) => ({ ...prev, slug: slugify(prev.name || "") }));
  }, [formData.name]);

  const { user } = useAdminAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.globalRole === "super_admin";

  const { data: estates, isLoading } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/estates", { search }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      const queryString = params.toString();
      return adminApiRequest(
        "GET",
        `/api/admin/estates${queryString ? "?" + queryString : ""}`,
      );
    },
  });

  const createEstateMutation = useMutation({
    mutationFn: (estateData: any) =>
      adminApiRequest("POST", "/api/admin/estates", estateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/estates"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Estate created successfully" });
    },
    onError: (error: any) => {
      const serverErr = error?.response?.data;
      const desc = serverErr?.details
        ? Array.isArray(serverErr.details)
          ? serverErr.details.join("; ")
          : JSON.stringify(serverErr.details)
        : serverErr?.error || error.message || "Failed to create estate";

      toast({
        title: "Error creating estate",
        description: desc,
        variant: "destructive",
      });
    },
  });

  const updateEstateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      adminApiRequest("PATCH", `/api/admin/estates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/estates"] });
      setEditingEstate(null);
      resetForm();
      toast({ title: "Estate updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating estate",
        description: error.response?.data?.error || "Failed to update estate",
        variant: "destructive",
      });
    },
  });

  const deleteEstateMutation = useMutation({
    mutationFn: (estateId: string) =>
      adminApiRequest("DELETE", `/api/admin/estates/${estateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/estates"] });
      toast({ title: "Estate deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting estate",
        description: error.response?.data?.error || "Failed to delete estate",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      address: "",
      settings: {
        servicesEnabled: [],
        marketplaceEnabled: true,
        paymentMethods: [],
        deliveryRules: {},
      },
    });
  };

  const handleEdit = (estate: any) => {
    setEditingEstate(estate);
    setFormData({
      name: estate.name || "",
      slug: estate.slug || slugify(estate.name || ""),
      description: estate.description || "",
      address: estate.address || "",
      settings: estate.settings || {
        servicesEnabled: [],
        marketplaceEnabled: true,
        paymentMethods: [],
        deliveryRules: {},
      },
    });
  };

  const handleSubmit = () => {
    if (editingEstate) {
      updateEstateMutation.mutate({ id: editingEstate._id || editingEstate.id, ...formData });
    } else {
      createEstateMutation.mutate({
        ...formData,
        coverage: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0],
            ],
          ], // Default polygon
        },
      });
    }
  };

  const handleDelete = (estateId: string) => {
    if (confirm("Are you sure you want to delete this estate?")) {
      deleteEstateMutation.mutate(estateId);
    }
  };

  const estateRows = isLoading
    ? Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          </TableCell>
        </TableRow>
      ))
    : estates && estates.length > 0
    ? estates.map((estate: any) => {
        const estateId = estate._id || estate.id;
        return (
          <TableRow key={estateId}>
            <TableCell className="font-medium" data-testid={`estate-name-${estateId}`}>
              {estate.name}
            </TableCell>
            <TableCell data-testid={`estate-address-${estateId}`}>{estate.address}</TableCell>
            <TableCell>
              <Badge variant={estate.settings?.marketplaceEnabled ? "default" : "secondary"}>
                {estate.settings?.marketplaceEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {estate.settings?.servicesEnabled?.length || 0} services
              </span>
            </TableCell>
            <TableCell data-testid={`estate-created-${estateId}`}>
              {new Date(estate.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(estate)}
                  data-testid={`button-edit-estate-${estateId}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(estateId)}
                    data-testid={`button-delete-estate-${estateId}`}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })
    : (
      <TableRow>
        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
          No estates found
        </TableCell>
      </TableRow>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Estate Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage estates and their configurations
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="button-add-estate"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Estate
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search estates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-estates"
            />
          </div>
        </CardContent>
      </Card>

      {/* Estates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : estates && estates.length > 0 ? (
                estates.map((estate: any) => {
                  const estateId = estate._id || estate.id;
                  return (
                    <TableRow key={estateId}>
                      <TableCell
                        className="font-medium"
                        data-testid={`estate-name-${estateId}`}
                      >
                        {estate.name}
                      </TableCell>
                      <TableCell data-testid={`estate-address-${estateId}`}>
                        {estate.address}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            estate.settings?.marketplaceEnabled
                              ? "default"
                              : "secondary"
                          }
                        >
                          {estate.settings?.marketplaceEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {estate.settings?.servicesEnabled?.length || 0} services
                        </span>
                      </TableCell>
                      <TableCell data-testid={`estate-created-${estateId}`}>
                        {new Date(estate.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(estate)}
                            data-testid={`button-edit-estate-${estateId}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(estateId)}
                              data-testid={`button-delete-estate-${estateId}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-gray-500"
                  >
                    No estates found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || !!editingEstate}
        onOpenChange={() => {
          setIsCreateDialogOpen(false);
          setEditingEstate(null);
          resetForm();
        }}
      >
        <DialogContent className="w-[60vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>
              {editingEstate ? "Edit Estate" : "Create New Estate"}
            </DialogTitle>
            <DialogDescription>
              {editingEstate
                ? "Update estate information"
                : "Add a new estate to the platform"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estateName">Estate Name</Label>
                <Input
                  id="estateName"
                  placeholder="Enter estate name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  data-testid="input-estate-name"
                />
              </div>
              <div>
                <Label htmlFor="estateSlug">Slug</Label>
                <Input
                  id="estateSlug"
                  placeholder="estate-slug"
                  value={formData.slug}
                  readOnly
                  data-testid="input-estate-slug"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Slug is auto-generated from the estate name and is read-only.
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="estateAddress">Address</Label>
              <Input
                id="estateAddress"
                placeholder="Enter estate address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                data-testid="input-estate-address"
              />
            </div>

            <div>
              <Label htmlFor="estateDescription">Description</Label>
              <Textarea
                id="estateDescription"
                placeholder="Enter estate description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                data-testid="textarea-estate-description"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="marketplaceEnabled"
                checked={formData.settings.marketplaceEnabled}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      marketplaceEnabled: e.target.checked,
                    },
                  })
                }
                data-testid="checkbox-marketplace-enabled"
              />
              <Label htmlFor="marketplaceEnabled">Enable Marketplace</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingEstate(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                createEstateMutation.isPending || updateEstateMutation.isPending
              }
              data-testid="button-submit-estate"
            >
              {createEstateMutation.isPending || updateEstateMutation.isPending
                ? "Saving..."
                : editingEstate
                  ? "Update Estate"
                  : "Create Estate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Orders Management Component
const OrdersManagement = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [disputeFilter, setDisputeFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeAction, setDisputeAction] = useState<"create" | "resolve">(
    "create",
  );
  const [disputeForm, setDisputeForm] = useState({
    reason: "",
    description: "",
    status: "resolved",
    resolution: "",
    refundAmount: 0,
  });

  // Query parameters
  const queryParams = {
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    hasDispute:
      disputeFilter === "disputes"
        ? "true"
        : disputeFilter === "no-disputes"
          ? "false"
          : undefined,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    minTotal: priceRange.min ? Number(priceRange.min) : undefined,
    maxTotal: priceRange.max ? Number(priceRange.max) : undefined,
    page,
    limit,
    sortBy,
    sortOrder,
  };

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders", queryParams],
    queryFn: () => adminApiRequest("GET", "/api/admin/orders", queryParams),
  });

  const { data: orderStats } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders/analytics/stats"],
    queryFn: () => adminApiRequest("GET", "/api/admin/orders/analytics/stats"),
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      adminApiRequest("PATCH", `/api/admin/orders/${orderId}/status`, {
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders"] });
      queryClient.invalidateQueries({
        queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders/analytics/stats"],
      });
      setShowOrderDetails(false);
    },
  });

  const createDisputeMutation = useMutation({
    mutationFn: ({
      orderId,
      reason,
      description,
    }: {
      orderId: string;
      reason: string;
      description?: string;
    }) =>
      adminApiRequest("POST", `/api/admin/orders/${orderId}/dispute`, {
        reason,
        description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders"] });
      setShowDisputeModal(false);
      setDisputeForm({
        reason: "",
        description: "",
        status: "resolved",
        resolution: "",
        refundAmount: 0,
      });
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
      resolution,
      refundAmount,
    }: {
      orderId: string;
      status: string;
      resolution: string;
      refundAmount?: number;
    }) =>
      adminApiRequest("PATCH", `/api/admin/orders/${orderId}/dispute`, {
        status,
        resolution,
        refundAmount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders"] });
      queryClient.invalidateQueries({
        queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders/analytics/stats"],
      });
      setShowDisputeModal(false);
      setDisputeForm({
        reason: "",
        description: "",
        status: "resolved",
        resolution: "",
        refundAmount: 0,
      });
    },
  });

  const handleStatusChange = (orderId: string, status: string) => {
    updateOrderStatusMutation.mutate({ orderId, status });
  };

  const handleCreateDispute = () => {
    if (selectedOrder && disputeForm.reason) {
      createDisputeMutation.mutate({
        orderId: selectedOrder._id,
        reason: disputeForm.reason,
        description: disputeForm.description,
      });
    }
  };

  const handleResolveDispute = () => {
    if (selectedOrder && disputeForm.resolution) {
      resolveDisputeMutation.mutate({
        orderId: selectedOrder._id,
        status: disputeForm.status as "resolved" | "rejected" | "escalated",
        resolution: disputeForm.resolution,
        refundAmount: disputeForm.refundAmount || undefined,
      });
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDisputeFilter("all");
    setDateRange({ start: "", end: "" });
    setPriceRange({ min: "", max: "" });
    setPage(1);
  };

  const orders = ordersData?.orders || [];
  const pagination = ordersData?.pagination;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getDisputeStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      case "escalated":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Orders Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage orders, track status, and resolve disputes
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {orderStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {orderStats.totalOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    â‚¦{orderStats.totalRevenue?.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Disputed Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {orderStats.disputedOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Avg Order Value
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    â‚¦{orderStats.avgOrderValue?.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div>
              <Label htmlFor="search">Search Orders</Label>
              <Input
                id="search"
                placeholder="Search by order ID, customer, vendor..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page when searching
                }}
                data-testid="input-search-orders"
              />
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dispute-filter">Disputes</Label>
              <Select value={disputeFilter} onValueChange={setDisputeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Orders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="disputes">With Disputes</SelectItem>
                  <SelectItem value="no-disputes">No Disputes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                data-testid="input-start-date"
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                data-testid="input-end-date"
              />
            </div>

            <div>
              <Label htmlFor="min-price">Min Price (â‚¦)</Label>
              <Input
                id="min-price"
                type="number"
                placeholder="0"
                value={priceRange.min}
                onChange={(e) =>
                  setPriceRange((prev) => ({ ...prev, min: e.target.value }))
                }
                data-testid="input-min-price"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={resetFilters}
                className="w-full"
                data-testid="button-reset-filters"
              >
                <X className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {ordersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Loading orders...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No orders found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Dispute
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {orders.map((order: any) => (
                    <tr
                      key={order._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        #{order._id.slice(-8)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {order.buyer?.name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {order.vendor?.name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        â‚¦{order.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {order.dispute?.reason ? (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDisputeStatusColor(order.dispute.status)}`}
                          >
                            {order.dispute.status}
                          </span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderDetails(true);
                          }}
                          data-testid={`button-view-order-${order._id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {order.status === "delivered" &&
                          !order.dispute?.reason && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setDisputeAction("create");
                                setShowDisputeModal(true);
                              }}
                              data-testid={`button-create-dispute-${order._id}`}
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                          )}
                        {order.dispute?.reason &&
                          order.dispute.status === "open" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setDisputeAction("resolve");
                                setShowDisputeModal(true);
                              }}
                              data-testid={`button-resolve-dispute-${order._id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}{" "}
                  of {pagination.total} orders
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage(Math.min(pagination.totalPages, page + 1))
                    }
                    disabled={page === pagination.totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order ID</Label>
                  <p className="text-sm font-mono">#{selectedOrder._id}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <Label>Customer</Label>
                  <p className="text-sm">{selectedOrder.buyer?.name}</p>
                </div>
                <div>
                  <Label>Vendor</Label>
                  <p className="text-sm">{selectedOrder.vendor?.name}</p>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <p className="text-sm font-medium">
                    â‚¦{selectedOrder.total.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label>Date</Label>
                  <p className="text-sm">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <Label>Order Items</Label>
                <div className="mt-2 space-y-2">
                  {selectedOrder.items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          Quantity: {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium">
                        â‚¦{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispute Info */}
              {selectedOrder.dispute?.reason && (
                <div>
                  <Label>Dispute Information</Label>
                  <div className="mt-2 p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-red-800 dark:text-red-200">
                        Reason: {selectedOrder.dispute.reason}
                      </p>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getDisputeStatusColor(selectedOrder.dispute.status)}`}
                      >
                        {selectedOrder.dispute.status}
                      </span>
                    </div>
                    {selectedOrder.dispute.resolvedAt && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Resolved:{" "}
                        {new Date(
                          selectedOrder.dispute.resolvedAt,
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Status Actions */}
              {["pending", "processing"].includes(selectedOrder.status) && (
                <div>
                  <Label>Update Status</Label>
                  <div className="mt-2 flex space-x-2">
                    {selectedOrder.status === "pending" && (
                      <Button
                        onClick={() =>
                          handleStatusChange(selectedOrder._id, "processing")
                        }
                        disabled={updateOrderStatusMutation.isPending}
                        data-testid="button-mark-processing"
                      >
                        Mark as Processing
                      </Button>
                    )}
                    {selectedOrder.status === "processing" && (
                      <Button
                        onClick={() =>
                          handleStatusChange(selectedOrder._id, "delivered")
                        }
                        disabled={updateOrderStatusMutation.isPending}
                        data-testid="button-mark-delivered"
                      >
                        Mark as Delivered
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() =>
                        handleStatusChange(selectedOrder._id, "cancelled")
                      }
                      disabled={updateOrderStatusMutation.isPending}
                      data-testid="button-cancel-order"
                    >
                      Cancel Order
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dispute Modal */}
      <Dialog open={showDisputeModal} onOpenChange={setShowDisputeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {disputeAction === "create"
                ? "Create Dispute"
                : "Resolve Dispute"}
            </DialogTitle>
          </DialogHeader>

          {disputeAction === "create" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="dispute-reason">Dispute Reason *</Label>
                <Input
                  id="dispute-reason"
                  value={disputeForm.reason}
                  onChange={(e) =>
                    setDisputeForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Brief reason for dispute"
                  data-testid="input-dispute-reason"
                />
              </div>
              <div>
                <Label htmlFor="dispute-description">Description</Label>
                <Textarea
                  id="dispute-description"
                  value={disputeForm.description}
                  onChange={(e) =>
                    setDisputeForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Detailed description of the issue"
                  rows={3}
                  data-testid="textarea-dispute-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDisputeModal(false)}
                  data-testid="button-cancel-dispute"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDispute}
                  disabled={
                    !disputeForm.reason || createDisputeMutation.isPending
                  }
                  data-testid="button-create-dispute"
                >
                  Create Dispute
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="dispute-status">Resolution Status *</Label>
                <Select
                  value={disputeForm.status}
                  onValueChange={(value) =>
                    setDisputeForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dispute-resolution">Resolution Details *</Label>
                <Textarea
                  id="dispute-resolution"
                  value={disputeForm.resolution}
                  onChange={(e) =>
                    setDisputeForm((prev) => ({
                      ...prev,
                      resolution: e.target.value,
                    }))
                  }
                  placeholder="Detailed resolution or action taken"
                  rows={3}
                  data-testid="textarea-dispute-resolution"
                />
              </div>
              <div>
                <Label htmlFor="refund-amount">Refund Amount (â‚¦)</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  value={disputeForm.refundAmount}
                  onChange={(e) =>
                    setDisputeForm((prev) => ({
                      ...prev,
                      refundAmount: Number(e.target.value),
                    }))
                  }
                  placeholder="0"
                  min="0"
                  max={selectedOrder?.total}
                  data-testid="input-refund-amount"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDisputeModal(false)}
                  data-testid="button-cancel-resolve"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResolveDispute}
                  disabled={
                    !disputeForm.resolution || resolveDisputeMutation.isPending
                  }
                  data-testid="button-resolve-dispute"
                >
                  Resolve Dispute
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Companies Management Component
const CompaniesManagement = ({ categoriesList = [] }: { categoriesList?: any[] }) => {
  const { toast } = useToast();
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showViewCompany, setShowViewCompany] = useState(false);
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    contactEmail: "",
    phone: "",
    isActive: false,
    // Business Details
    businessAddress: "",
    businessCity: "",
    businessState: "",
    businessZipCode: "",
    businessCountry: "",
    businessType: "",
    // Registration & Compliance
    businessRegNumber: "",
    businessTaxId: "",
    // Bank Details
    bankAccountName: "",
    bankName: "",
    bankAccountNumber: "",
    bankRoutingNumber: "",
    details: [] as Array<{ key: string; value: string }>,
  });
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});

  const FIELD_LABELS: Record<string, string> = {
    bankName: "Bank name",
    accountNumber: "Account number",
    routingNumber: "Routing number",
    swiftCode: "SWIFT code",
    accountName: "Account name",
    notes: "Notes",
    taxId: "Tax ID",
    industry: "Industry",
    businessType: "Business type",
    yearEstablished: "Year established",
    registrationNumber: "Registration number",
    lga: "LGA",
    city: "City",
    state: "State",
    country: "Country",
    coordinates: "Coordinates",
    latitude: "Latitude",
    longitude: "Longitude",
  };

  function friendlyLabel(k: string) {
    return FIELD_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (s) => s.toUpperCase());
  }

  const [location, setLocation] = useLocation();
  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => adminApiRequest("GET", "/api/admin/companies"),
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Refetch every 60 seconds
  });
  const { data: pendingCompanies = [], isLoading: isPendingCompaniesLoading } = useQuery({
    queryKey: ["admin-companies-pending"],
    queryFn: () => adminApiRequest("GET", "/api/admin/companies", { pending: true }),
    staleTime: 15_000,
  });
  const companyMembersCompanyId = (() => {
    const segments = location.split("/").filter(Boolean);
    if (
      segments[0] === "admin-dashboard" &&
      segments[1] === "companies" &&
      segments[2] === "members"
    ) {
      return segments[3] || null;
    }
    return null;
  })();
  const companyStoresCompanyId = (() => {
    const segments = location.split("/").filter(Boolean);
    if (
      segments[0] === "admin-dashboard" &&
      segments[1] === "companies" &&
      segments[2] === "stores"
    ) {
      return segments[3] || null;
    }
    return null;
  })();
  const isCompanyMembersPage = Boolean(companyMembersCompanyId);
  const isCompanyStoresPage = Boolean(companyStoresCompanyId);
  const selectedCompanyForMembers =
    companyMembersCompanyId && Array.isArray(companies)
      ? companies.find((company: any) => (company.id || company._id) === companyMembersCompanyId)
      : null;
  const goToCompanies = () => setLocation("/admin-dashboard/companies");
  const goToCompanyMembers = (companyId: string) =>
    setLocation(`/admin-dashboard/companies/members/${companyId}`);
  const companyMatchesProvider = (provider: any, company: any) => {
    if (!provider || !company) return false;
    // Get company value from provider (try multiple field names)
    const providerCompanyValue = provider.company || provider.companyId || provider.company_id;
    if (!providerCompanyValue) return false;
    // If it's an object, extract the id
    const providerCompanyId = typeof providerCompanyValue === 'object'
      ? (providerCompanyValue.id || providerCompanyValue._id)
      : providerCompanyValue;
    const providerCompanyStr = String(providerCompanyId || "").trim().toLowerCase();
    const companyName = String(company.name || "").trim().toLowerCase();
    const companyId = String(company.id || company._id || "").trim().toLowerCase();
    return providerCompanyStr === companyName || providerCompanyStr === companyId;
  };
  const { data: companyProvidersRaw = [] } = useQuery({
    queryKey: ["/api/admin/users/all", { role: "provider", companyId: companyMembersCompanyId }],
    queryFn: () => adminApiRequest("GET", "/api/admin/users/all", { role: "provider" }),
    enabled: isCompanyMembersPage,
  });
  const { data: companyProviderRequests = [] } = useQuery({
    queryKey: ["admin/provider-requests", companyMembersCompanyId],
    queryFn: () => adminApiRequest("GET", "/api/admin/provider-requests"),
    enabled: isCompanyMembersPage,
  });
  const { data: companyServiceRequests = [] } = useQuery({
    queryKey: ["/api/admin/bridge/service-requests", companyMembersCompanyId],
    queryFn: () => adminApiRequest("GET", "/api/admin/bridge/service-requests"),
    enabled: isCompanyMembersPage,
  });
  const companyProviders = Array.isArray(companyProvidersRaw) && selectedCompanyForMembers
    ? companyProvidersRaw.filter((provider: any) => companyMatchesProvider(provider, selectedCompanyForMembers))
    : [];
  const companyProviderIds = new Set(
    companyProviders.map((provider: any) => provider.id || provider._id),
  );
  const providerLookup = new Map(
    companyProviders.map((provider: any) => [provider.id || provider._id, provider]),
  );
  const companyRequests = Array.isArray(companyServiceRequests)
    ? companyServiceRequests.filter((req: any) =>
        companyProviderIds.has(req.providerId || req.provider_id),
      )
    : [];
  const pendingProviderRequests = Array.isArray(companyProviderRequests) && selectedCompanyForMembers
    ? companyProviderRequests.filter((req: any) => {
        const companyName = String(selectedCompanyForMembers.name || "").toLowerCase();
        const companyId = String(selectedCompanyForMembers.id || selectedCompanyForMembers._id || "").toLowerCase();
        const reqCompany = String(req.company || "").toLowerCase();
        return reqCompany === companyName || reqCompany === companyId;
      })
    : [];
  const availableProviders = Array.isArray(companyProvidersRaw) && selectedCompanyForMembers
    ? companyProvidersRaw.filter((provider: any) => !companyMatchesProvider(provider, selectedCompanyForMembers))
    : [];
  const updateProviderApprovalMutation = useMutation({
    mutationFn: ({ providerId, approved }: { providerId: string; approved: boolean }) =>
      adminApiRequest("PATCH", `/api/admin/users/${providerId}`, { isApproved: approved }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["admin/provider-requests"] });
      toast({ title: "Provider updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update provider",
        description: error.response?.data?.error || "Unable to update provider.",
        variant: "destructive",
      });
    },
  });
  const assignProviderToCompanyMutation = useMutation({
    mutationFn: (providerId: string) =>
      adminApiRequest("PATCH", `/api/admin/users/${providerId}`, {
        company: String(selectedCompanyForMembers?.id || selectedCompanyForMembers?._id || ""),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      toast({ title: "Provider assigned to company" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign provider",
        description: error.response?.data?.error || "Unable to assign provider.",
        variant: "destructive",
      });
    },
  });
  const removeProviderFromCompanyMutation = useMutation({
    mutationFn: (providerId: string) =>
      adminApiRequest("PATCH", `/api/admin/users/${providerId}`, {
        company: "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      toast({ title: "Provider removed from company" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove provider",
        description: error.response?.data?.error || "Unable to remove provider.",
        variant: "destructive",
      });
    },
  });

  const assignCategoriesToProviderMutation = useMutation({
    mutationFn: ({ providerId, categories }: { providerId: string; categories: string[] }) =>
      adminApiRequest("PATCH", `/api/admin/users/${providerId}`, {
        categories: categories,
      }),
    onSuccess: () => {
      // Invalidate all related queries to ensure changes reflect across the app
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      // Invalidate any company-related queries that might cache provider data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      // Invalidate store-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace"] });
      // Invalidate provider requests queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/provider-requests"] });
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] });
      // Invalidate service requests that might reference providers
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-requests"] });
      toast({ title: "Categories assigned successfully" });
      setShowCategoryDialog(false);
      setSelectedProviderForCategory(null);
      setSelectedCategories([]);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign categories",
        description: error.response?.data?.error || "Unable to assign categories.",
        variant: "destructive",
      });
    },
  });
  const assignServiceRequestMutation = useMutation({
    mutationFn: ({ requestId, providerId }: { requestId: string; providerId: string }) =>
      adminApiRequest("POST", `/api/admin/service-requests/${requestId}/assign`, { providerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bridge/service-requests"] });
      toast({ title: "Service request assigned" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign request",
        description: error.response?.data?.message || "Unable to assign request.",
        variant: "destructive",
      });
    },
  });
  const [companyTaskForm, setCompanyTaskForm] = useState({
    title: "",
    description: "",
    assigneeId: "",
    priority: "medium",
    status: "open",
    dueDate: "",
  });
  const [companyTasks, setCompanyTasks] = useState<any[]>([]);
  useEffect(() => {
    if (!companyMembersCompanyId) return;
    const key = `company-members:${companyMembersCompanyId}:tasks`;
    const saved = window.localStorage.getItem(key);
    setCompanyTasks(saved ? JSON.parse(saved) : []);
  }, [companyMembersCompanyId]);
  useEffect(() => {
    if (!companyMembersCompanyId) return;
    const key = `company-members:${companyMembersCompanyId}:tasks`;
    window.localStorage.setItem(key, JSON.stringify(companyTasks));
  }, [companyTasks, companyMembersCompanyId]);

  const createCompanyMutation = useMutation({
    mutationFn: (payload: any) =>
      adminApiRequest("POST", "/api/admin/companies", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      setForm({
        name: "",
        description: "",
        contactEmail: "",
        phone: "",
        isActive: false,
        businessAddress: "",
        businessCity: "",
        businessState: "",
        businessZipCode: "",
        businessCountry: "",
        businessType: "",
        businessRegNumber: "",
        businessTaxId: "",
        bankAccountName: "",
        bankName: "",
        bankAccountNumber: "",
        bankRoutingNumber: "",
        details: [],
      });
      setShowAddCompany(false);
      toast({ title: "Company created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating company",
        description: error.response?.data?.error || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (payload: any) =>
      adminApiRequest("PUT", `/api/admin/companies/${selectedCompany.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      setForm({
        name: "",
        description: "",
        contactEmail: "",
        phone: "",
        isActive: false,
        businessAddress: "",
        businessCity: "",
        businessState: "",
        businessZipCode: "",
        businessCountry: "",
        businessType: "",
        businessRegNumber: "",
        businessTaxId: "",
        bankAccountName: "",
        bankName: "",
        bankAccountNumber: "",
        bankRoutingNumber: "",
        details: [],
      });
      setSelectedCompany(null);
      setShowEditCompany(false);
      toast({ title: "Company updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating company",
        description: error.response?.data?.error || "Failed to update company",
        variant: "destructive",
      });
    },
  });

  const verifyCompanyMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApiRequest("PATCH", `/api/admin/companies/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-companies-pending"] });
      toast({ title: "Company verification updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update company",
        description: error.response?.data?.error || "Unable to update company.",
        variant: "destructive",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: () =>
      adminApiRequest("DELETE", `/api/admin/companies/${selectedCompany.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      setSelectedCompany(null);
      setShowDeleteConfirm(false);
      toast({ title: "Company deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting company",
        description: error.response?.data?.error || "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload: any = {
      name: form.name,
      description: form.description,
      contactEmail: form.contactEmail,
      phone: form.phone,
      isActive: !!form.isActive,
      // Business Details
      businessAddress: form.businessAddress,
      businessCity: form.businessCity,
      businessState: form.businessState,
      businessZipCode: form.businessZipCode,
      businessCountry: form.businessCountry,
      businessType: form.businessType,
      // Registration & Compliance
      businessRegNumber: form.businessRegNumber,
      businessTaxId: form.businessTaxId,
      // Bank Details
      bankAccountName: form.bankAccountName,
      bankName: form.bankName,
      bankAccountNumber: form.bankAccountNumber,
      bankRoutingNumber: form.bankRoutingNumber,
    };
    createCompanyMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    
    // Build businessDetails object with all values
    const businessDetailsObj: any = {};
    if (form.businessAddress) businessDetailsObj.address = form.businessAddress;
    if (form.businessCity) businessDetailsObj.city = form.businessCity;
    if (form.businessState) businessDetailsObj.state = form.businessState;
    if (form.businessZipCode) businessDetailsObj.zipCode = form.businessZipCode;
    if (form.businessCountry) businessDetailsObj.country = form.businessCountry;
    if (form.businessType) businessDetailsObj.type = form.businessType;
    if (form.businessRegNumber) businessDetailsObj.registrationNumber = form.businessRegNumber;
    if (form.businessTaxId) businessDetailsObj.taxId = form.businessTaxId;

    // Build bankDetails object with all values
    const bankDetailsObj: any = {};
    if (form.bankAccountName) bankDetailsObj.accountName = form.bankAccountName;
    if (form.bankName) bankDetailsObj.bankName = form.bankName;
    if (form.bankAccountNumber) bankDetailsObj.accountNumber = form.bankAccountNumber;
    if (form.bankRoutingNumber) bankDetailsObj.routingNumber = form.bankRoutingNumber;

    const payload: any = {
      name: form.name,
      description: form.description,
      contactEmail: form.contactEmail,
      phone: form.phone,
      isActive: !!form.isActive,
      // Always include businessDetails and bankDetails to replace old data
      businessDetails: businessDetailsObj,
      bankDetails: bankDetailsObj,
    };

    // Handle old-style details array if present
    if (Array.isArray(form.details) && form.details.length > 0) {
      const obj: any = {};
      form.details.forEach((entry: any) => {
        if (entry.key) {
          try {
            obj[entry.key] = JSON.parse(entry.value);
          } catch {
            obj[entry.key] = entry.value;
          }
        }
      });
      payload.details = obj;
    }

    console.log("handleUpdate payload:", JSON.stringify(payload, null, 2));
    updateCompanyMutation.mutate(payload);
  };

  const handleViewCompany = (company: any) => {
    setSelectedCompany(company);
    setShowViewCompany(true);
  };

  const handleEditCompany = (company: any) => {
    setSelectedCompany(company);
    
    // Extract business details from nested object
    const businessDetails = company.businessDetails || {};
    const bankDetails = company.bankDetails || {};
    
    setForm({
      name: company.name || "",
      description: company.description || "",
      contactEmail: company.contactEmail || "",
      phone: company.phone || "",
      isActive: company.isActive ?? true,
      businessAddress: businessDetails.address || "",
      businessCity: businessDetails.city || "",
      businessState: businessDetails.state || "",
      businessZipCode: businessDetails.zipCode || "",
      businessCountry: businessDetails.country || "",
      businessType: businessDetails.type || "",
      businessRegNumber: businessDetails.registrationNumber || "",
      businessTaxId: businessDetails.taxId || "",
      bankAccountName: bankDetails.accountName || "",
      bankName: bankDetails.bankName || "",
      bankAccountNumber: bankDetails.accountNumber || "",
      bankRoutingNumber: bankDetails.routingNumber || "",
      details: company.details
        ? Object.entries(company.details).map(([k, v]) => ({ key: k, value: typeof v === "object" ? JSON.stringify(v) : String(v) }))
        : [],
    });
    setShowEditCompany(true);
  };

  const handleDeleteCompany = (company: any) => {
    setSelectedCompany(company);
    setShowDeleteConfirm(true);
  };

  const resetAddForm = () => {
    setForm({
      name: "",
      description: "",
      contactEmail: "",
      phone: "",
      isActive: true,
      businessAddress: "",
      businessCity: "",
      businessState: "",
      businessZipCode: "",
      businessCountry: "",
      businessType: "",
      businessRegNumber: "",
      businessTaxId: "",
      bankAccountName: "",
      bankName: "",
      bankAccountNumber: "",
      bankRoutingNumber: "",
      details: [],
    });
    setShowAddCompany(false);
  };

  const resetEditForm = () => {
    setForm({
      name: "",
      description: "",
      contactEmail: "",
      phone: "",
      isActive: true,
      businessAddress: "",
      businessCity: "",
      businessState: "",
      businessZipCode: "",
      businessCountry: "",
      businessType: "",
      businessRegNumber: "",
      businessTaxId: "",
      bankAccountName: "",
      bankName: "",
      bankAccountNumber: "",
      bankRoutingNumber: "",
      details: [],
    });
    setSelectedCompany(null);
    setShowEditCompany(false);
  };

  const totalProviders = companyProviders.length;
  const approvedProviders = companyProviders.filter((p: any) => p.isApproved).length;
  const pendingApprovalsCount = pendingProviderRequests.length;
  const avgRating =
    totalProviders > 0
      ? (
          companyProviders.reduce((acc: number, p: any) => acc + Number(p.rating || 0), 0) /
          totalProviders
        ).toFixed(1)
      : "0.0";
  const openCompanyRequests = companyRequests.filter((req: any) => {
    const status = String(req.status || "").toLowerCase();
    return status !== "completed" && status !== "cancelled";
  });
  const maintenanceRequests = companyRequests.filter((req: any) => {
    const category = String(req.category || "").toLowerCase();
    return category.includes("maintenance");
  });
  const activityEvents = companyRequests
    .slice()
    .sort((a: any, b: any) => {
      const aTime = new Date(a.createdAt || a.created_at || 0).getTime();
      const bTime = new Date(b.createdAt || b.created_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 6);
  const unassignedRequests = Array.isArray(companyServiceRequests)
    ? companyServiceRequests.filter((req: any) => !req.providerId && !req.provider_id)
    : [];

  // Helper function to safely display emoji
  const safeEmoji = (emoji: string | null | undefined): string => {
    if (!emoji) return "";
    // Check if emoji is valid by testing if it's a proper character
    const cleaned = emoji.trim();
    if (cleaned.length === 0) return "";
    // Return only single emoji or valid characters
    return /^[\p{Emoji}]+$/u.test(cleaned) ? cleaned : "";
  };

  const [serviceAssignment, setServiceAssignment] = useState({
    requestId: "",
    providerId: "",
  });
  const [selectedProviderToAdd, setSelectedProviderToAdd] = useState("");
  const [showCompanyActions, setShowCompanyActions] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [selectedProviderForCategory, setSelectedProviderForCategory] = useState<any>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [providersViewMode, setProvidersViewMode] = useState<"table" | "card">("table");
  const handleAddCompanyTask = () => {
    if (!companyTaskForm.title.trim() || !companyTaskForm.assigneeId) {
      toast({
        title: "Task title and assignee required",
        variant: "destructive",
      });
      return;
    }
    const newTask = {
      id: crypto.randomUUID(),
      title: companyTaskForm.title.trim(),
      description: companyTaskForm.description.trim(),
      assigneeId: companyTaskForm.assigneeId,
      priority: companyTaskForm.priority,
      status: companyTaskForm.status,
      dueDate: companyTaskForm.dueDate,
      createdAt: new Date().toISOString(),
    };
    setCompanyTasks((prev) => [newTask, ...prev]);
    setCompanyTaskForm({
      title: "",
      description: "",
      assigneeId: "",
      priority: "medium",
      status: "open",
      dueDate: "",
    });
  };
  const handleAssignServiceRequest = () => {
    if (!serviceAssignment.requestId || !serviceAssignment.providerId) {
      toast({
        title: "Select request and provider",
        variant: "destructive",
      });
      return;
    }
    assignServiceRequestMutation.mutate({
      requestId: serviceAssignment.requestId,
      providerId: serviceAssignment.providerId,
    });
    setServiceAssignment({ requestId: "", providerId: "" });
  };

  if (isCompanyMembersPage) {
    if (!selectedCompanyForMembers) {
      return (
        <div className="space-y-4">
          <Button variant="outline" onClick={goToCompanies}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Companies
          </Button>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Company not found. Return to companies list and try again.
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Button variant="ghost" className="px-0" onClick={goToCompanies}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Companies
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {selectedCompanyForMembers.name} Members
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage providers, approvals, and assignments for this company.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] })}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!companyMembersCompanyId) return;
                setLocation(`/admin-dashboard/companies/stores/${encodeURIComponent(String(companyMembersCompanyId))}`);
              }}
            >
              <Store className="w-4 h-4 mr-2" />
              Manage Stores
            </Button>
            <Button onClick={() => setShowCompanyActions(true)}>
              <ClipboardList className="w-4 h-4 mr-2" />
              Manage Actions
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Providers</div>
              <div className="text-2xl font-semibold">{totalProviders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Approved Providers</div>
              <div className="text-2xl font-semibold">{approvedProviders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Pending Approvals</div>
              <div className="text-2xl font-semibold">{pendingApprovalsCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Average Rating</div>
              <div className="text-2xl font-semibold">{avgRating}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Company Providers</CardTitle>
                  <CardDescription>Active providers assigned to this company.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{providersViewMode === "table" ? "Table" : "Cards"}</span>
                  <button
                    onClick={() => setProvidersViewMode(providersViewMode === "table" ? "card" : "table")}
                    className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        providersViewMode === "card" ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {providersViewMode === "table" ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Categories</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyProviders.length > 0 ? (
                        companyProviders.map((provider: any) => {
                          const providerId = provider.id || provider._id;
                          const rating = provider.rating ? Number(provider.rating).toFixed(1) : "N/A";
                          return (
                            <TableRow key={providerId}>
                              <TableCell className="font-medium">{provider.name || provider.email}</TableCell>
                              <TableCell>{provider.email}</TableCell>
                              <TableCell>{rating}</TableCell>
                              <TableCell>
                                <Badge variant={provider.isApproved ? "default" : "secondary"}>
                                  {provider.isApproved ? "Approved" : "Pending"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {provider.categories && provider.categories.length > 0 ? (
                                    provider.categories.slice(0, 3).map((categoryId: string) => {
                                      const category = categoriesList.find((c: any) => c.id === categoryId || c._id === categoryId || c.key === categoryId);
                                      const emoji = safeEmoji(category?.emoji);
                                      return (
                                        <Badge key={categoryId} variant="outline" className="text-xs">
                                          {category ? `${emoji} ${category.name}`.trim() : categoryId}
                                        </Badge>
                                      );
                                    })
                                  ) : (
                                    <span className="text-xs text-muted-foreground">None</span>
                                  )}
                                  {provider.categories && provider.categories.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{provider.categories.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2 flex-wrap">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      updateProviderApprovalMutation.mutate({
                                        providerId,
                                        approved: !provider.isApproved,
                                      })
                                    }
                                  >
                                    {provider.isApproved ? "Revoke" : "Approve"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedProviderForCategory(provider);
                                      setSelectedCategories(provider.categories || []);
                                      setShowCategoryDialog(true);
                                    }}
                                  >
                                    Categories
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeProviderFromCompanyMutation.mutate(providerId)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                            No providers assigned yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="grid grid-cols-2 gap-4 p-4">
                    {companyProviders.length > 0 ? (
                      companyProviders.map((provider: any) => {
                        const providerId = provider.id || provider._id;
                        const rating = provider.rating ? Number(provider.rating).toFixed(1) : "N/A";
                        return (
                          <div key={providerId} className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors">
                            <div className="space-y-1">
                              <div className="font-semibold text-sm">{provider.name || provider.email}</div>
                              <div className="text-xs text-muted-foreground">{provider.email}</div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">Rating:</span>
                                <span className="text-sm font-semibold">{rating}</span>
                              </div>
                              <Badge variant={provider.isApproved ? "default" : "secondary"} className="text-xs">
                                {provider.isApproved ? "Approved" : "Pending"}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Categories</div>
                              <div className="flex flex-wrap gap-1">
                                {provider.categories && provider.categories.length > 0 ? (
                                  provider.categories.slice(0, 2).map((categoryId: string) => {
                                    const category = categoriesList.find((c: any) => c.id === categoryId || c._id === categoryId || c.key === categoryId);
                                    const emoji = safeEmoji(category?.emoji);
                                    return (
                                      <Badge key={categoryId} variant="outline" className="text-xs">
                                        {category ? `${emoji} ${category.name}`.trim() : categoryId}
                                      </Badge>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted-foreground">None</span>
                                )}
                                {provider.categories && provider.categories.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{provider.categories.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs h-8"
                                onClick={() =>
                                  updateProviderApprovalMutation.mutate({
                                    providerId,
                                    approved: !provider.isApproved,
                                  })
                                }
                              >
                                {provider.isApproved ? "Revoke" : "Approve"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs h-8"
                                onClick={() => {
                                  setSelectedProviderForCategory(provider);
                                  setSelectedCategories(provider.categories || []);
                                  setShowCategoryDialog(true);
                                }}
                              >
                                Categories
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8"
                                onClick={() => removeProviderFromCompanyMutation.mutate(providerId)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                        No providers assigned yet.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Service Requests</CardTitle>
                <CardDescription>Requests assigned to this companyâ€™s providers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Active: {openCompanyRequests.length}</Badge>
                  <Badge variant="outline">Maintenance: {maintenanceRequests.length}</Badge>
                </div>
                {openCompanyRequests.length > 0 ? (
                  openCompanyRequests.slice(0, 6).map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <div className="font-medium">{req.category || "Service Request"}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.description || "No description"}
                        </div>
                      </div>
                      <Badge variant="outline">{req.status || "pending"}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No active requests yet.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Provider Activity</CardTitle>
                <CardDescription>Recent activity and ratings from residents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activityEvents.length > 0 ? (
                  activityEvents.map((req: any) => {
                    const providerId = req.providerId || req.provider_id;
                    const provider = providerLookup.get(providerId);
                    return (
                      <div key={req.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {provider?.name || provider?.email || "Assigned provider"}
                          </div>
                          <Badge variant="outline">{req.status || "pending"}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {req.category || "Service request"} - Rating {provider?.rating ?? "N/A"}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-muted-foreground">No recent activity yet.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions Hub</CardTitle>
                <CardDescription>Open approvals, assignments, and tasks in one place.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <span>Pending approvals</span>
                    <Badge variant="outline">{pendingApprovalsCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <span>Unassigned requests</span>
                    <Badge variant="outline">{unassignedRequests.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <span>Open tasks</span>
                    <Badge variant="outline">{companyTasks.length}</Badge>
                  </div>
                </div>
                <Button className="w-full" onClick={() => setShowCompanyActions(true)}>
                  Open Actions
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        <Dialog open={showCompanyActions} onOpenChange={setShowCompanyActions}>
          <DialogContent className="w-[70vw] max-w-5xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Company Actions</DialogTitle>
              <DialogDescription>
                Approvals, assignments, and task management for {selectedCompanyForMembers.name}.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="approvals">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="approvals">Approvals</TabsTrigger>
                <TabsTrigger value="add-provider">Add Provider</TabsTrigger>
                <TabsTrigger value="requests">Requests</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              <TabsContent value="approvals" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Approvals</CardTitle>
                    <CardDescription>Provider requests waiting for approval.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pendingProviderRequests.length > 0 ? (
                      pendingProviderRequests.map((req: any) => (
                        <div key={req.id} className="rounded-lg border border-border p-3">
                          <div className="font-medium">{req.name || req.email}</div>
                          <div className="text-xs text-muted-foreground">{req.email}</div>
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() =>
                              updateProviderApprovalMutation.mutate({
                                providerId: req.providerId,
                                approved: true,
                              })
                            }
                            disabled={!req.providerId}
                          >
                            Approve Provider
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No pending approvals.</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="add-provider" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Provider</CardTitle>
                    <CardDescription>Assign an existing provider to this company.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={selectedProviderToAdd} onValueChange={setSelectedProviderToAdd}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProviders.length > 0 ? (
                          availableProviders.map((provider: any) => (
                            <SelectItem key={provider.id || provider._id} value={provider.id || provider._id}>
                              {provider.name || provider.email}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No available providers
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (!selectedProviderToAdd) {
                          toast({ title: "Select a provider", variant: "destructive" });
                          return;
                        }
                        assignProviderToCompanyMutation.mutate(selectedProviderToAdd);
                        setSelectedProviderToAdd("");
                      }}
                      disabled={assignProviderToCompanyMutation.isPending}
                    >
                      Add Provider
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="requests" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Assign Service Request</CardTitle>
                    <CardDescription>Allocate open requests to a provider.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select
                      value={serviceAssignment.requestId}
                      onValueChange={(value) => setServiceAssignment((prev) => ({ ...prev, requestId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select request" />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedRequests.length > 0 ? (
                          unassignedRequests.map((req: any) => (
                            <SelectItem key={req.id} value={req.id}>
                              {req.category || "Service request"}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No unassigned requests
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Select
                      value={serviceAssignment.providerId}
                      onValueChange={(value) => setServiceAssignment((prev) => ({ ...prev, providerId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {companyProviders.length > 0 ? (
                          companyProviders.map((provider: any) => (
                            <SelectItem key={provider.id || provider._id} value={provider.id || provider._id}>
                              {provider.name || provider.email}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No providers available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={handleAssignServiceRequest}>
                      Assign Request
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="tasks" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Task Allocation</CardTitle>
                    <CardDescription>Assign internal tasks and track progress.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Task title"
                      value={companyTaskForm.title}
                      onChange={(e) => setCompanyTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    <Textarea
                      placeholder="Task description"
                      value={companyTaskForm.description}
                      onChange={(e) => setCompanyTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                    <Select
                      value={companyTaskForm.assigneeId}
                      onValueChange={(value) => setCompanyTaskForm((prev) => ({ ...prev, assigneeId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Assign to provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {companyProviders.length > 0 ? (
                          companyProviders.map((provider: any) => (
                            <SelectItem key={provider.id || provider._id} value={provider.id || provider._id}>
                              {provider.name || provider.email}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No providers available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        value={companyTaskForm.priority}
                        onValueChange={(value) => setCompanyTaskForm((prev) => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={companyTaskForm.status}
                        onValueChange={(value) => setCompanyTaskForm((prev) => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="date"
                      value={companyTaskForm.dueDate}
                      onChange={(e) => setCompanyTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    />
                    <Button onClick={handleAddCompanyTask}>Add Task</Button>
                    <div className="space-y-2">
                      {companyTasks.length > 0 ? (
                        companyTasks.map((task) => (
                          <div key={task.id} className="rounded-lg border border-border p-3">
                            <div className="font-medium">{task.title}</div>
                            <div className="text-xs text-muted-foreground">{task.description || "No description"}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline">{task.priority}</Badge>
                              <Badge variant="outline">{task.status}</Badge>
                              {task.dueDate ? <Badge variant="outline">Due {task.dueDate}</Badge> : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No tasks assigned yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Category Assignment Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="max-w-3xl w-[60vw]">
            <DialogHeader>
              <DialogTitle>Assign Service Categories</DialogTitle>
              <DialogDescription>
                Select service categories for {selectedProviderForCategory?.name || selectedProviderForCategory?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedProviderForCategory?.categories && selectedProviderForCategory.categories.length > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm font-medium mb-2">Currently Assigned Categories:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedProviderForCategory.categories.map((categoryId: string) => {
                      const category = categoriesList.find((c: any) => 
                        c.id === categoryId || c._id === categoryId || c.key === categoryId
                      );
                      const emoji = safeEmoji(category?.emoji);
                      return (
                        <Badge key={categoryId} variant="outline" className="text-xs">
                          {category ? `${emoji} ${category.name}`.trim() : categoryId}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {categoriesList.length > 0 ? (
                  categoriesList.map((category: any) => (
                    <div key={category.id || category._id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id || category._id}`}
                        checked={selectedCategories.includes(category.id) || selectedCategories.includes(category._id) || selectedCategories.includes(category.key)}
                        onCheckedChange={(checked) => {
                          const categoryId = category.id || category._id;
                          if (checked) {
                            setSelectedCategories([...selectedCategories, categoryId]);
                          } else {
                            setSelectedCategories(selectedCategories.filter((c) => c !== categoryId && c !== category._id && c !== category.key));
                          }
                        }}
                      />
                      <label
                        htmlFor={`category-${category.id || category._id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {safeEmoji(category.emoji)} {category.name}
                      </label>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No categories available.</div>
                )}
              </div>
            </div>
            <DialogFooter className="flex items-center justify-between">
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (selectedProviderForCategory) {
                    const providerId = selectedProviderForCategory.id || selectedProviderForCategory._id;
                    assignCategoriesToProviderMutation.mutate({
                      providerId,
                      categories: [],
                    });
                  }
                }}
                disabled={assignCategoriesToProviderMutation.isPending || selectedCategories.length === 0}
              >
                Clear All Categories
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedProviderForCategory) {
                      const providerId = selectedProviderForCategory.id || selectedProviderForCategory._id;
                      assignCategoriesToProviderMutation.mutate({
                        providerId,
                        categories: selectedCategories,
                      });
                    }
                  }}
                  disabled={assignCategoriesToProviderMutation.isPending}
                >
                  {assignCategoriesToProviderMutation.isPending ? "Saving..." : "Save Categories"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (isCompanyStoresPage) {
    const companyId = String(companyStoresCompanyId);
    const company = Array.isArray(companies)
      ? companies.find((c: any) => String(c.id || c._id) === companyId)
      : null;
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Button variant="ghost" className="px-0" onClick={() => goToCompanyMembers(companyId)}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Company
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {company?.name || "Company"} Stores
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage stores and store owners for this company.
          </p>
        </div>

        <StoresManagement companyIdOverride={companyId} categoriesList={categoriesList} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Companies
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage provider companies and assign them to users.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-companies">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowAddCompany(true)} data-testid="button-open-add-company">
            <Plus className="w-4 h-4 mr-2" />
            Add Company
          </Button>
        </div>
      </div>

      {/* Add Company Dialog */}
      <Dialog open={showAddCompany} onOpenChange={(open) => {
        if (!open) resetAddForm();
        else setShowAddCompany(true);
      }}>
        <DialogContent className="w-[60vw] max-w-none max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
            <DialogDescription>Create a new provider company.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                placeholder="Company Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-company-name"
              />
            </div>
            <div>
              <Input
                placeholder="Contact Email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                data-testid="input-company-email"
              />
            </div>
            <div>
              <Input
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                data-testid="input-company-phone"
              />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <Textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                data-testid="textarea-company-description"
              />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="company-active-add"
                checked={!!form.isActive}
                onCheckedChange={(checked: any) => setForm({ ...form, isActive: !!checked })}
              />
              <Label htmlFor="company-active-add" className="text-sm">Active</Label>
            </div>

            {/* Business Registration Accordions */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <Accordion type="single" collapsible className="w-full">
                {/* Business Details Section */}
                <AccordionItem value="business-details">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-medium">Business Details</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label className="text-sm font-medium">Business Address</Label>
                      <Input
                        placeholder="Street address"
                        value={form.businessAddress || ""}
                        onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                        className="mt-1"
                        data-testid="input-business-address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">City</Label>
                        <Input
                          placeholder="City"
                          value={form.businessCity || ""}
                          onChange={(e) => setForm({ ...form, businessCity: e.target.value })}
                          className="mt-1"
                          data-testid="input-business-city"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">State/Province</Label>
                        <Input
                          placeholder="State/Province"
                          value={form.businessState || ""}
                          onChange={(e) => setForm({ ...form, businessState: e.target.value })}
                          className="mt-1"
                          data-testid="input-business-state"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">ZIP Code</Label>
                        <Input
                          placeholder="ZIP/Postal code"
                          value={form.businessZipCode || ""}
                          onChange={(e) => setForm({ ...form, businessZipCode: e.target.value })}
                          className="mt-1"
                          data-testid="input-business-zipcode"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Country</Label>
                        <Input
                          placeholder="Country"
                          value={form.businessCountry || ""}
                          onChange={(e) => setForm({ ...form, businessCountry: e.target.value })}
                          className="mt-1"
                          data-testid="input-business-country"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Business Type</Label>
                      <Select value={form.businessType || ""} onValueChange={(value) => setForm({ ...form, businessType: value })}>
                        <SelectTrigger className="w-full mt-1" data-testid="select-business-type">
                          <SelectValue placeholder="Select a business type" />
                        </SelectTrigger>
                        <SelectContent className="w-full">
                          {businessTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Registration & Compliance Section */}
                <AccordionItem value="registration-compliance">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-medium">Registration & Compliance</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label className="text-sm font-medium">Business Registration Number</Label>
                      <Input
                        placeholder="CAC/Registration number"
                        value={form.businessRegNumber || ""}
                        onChange={(e) => setForm({ ...form, businessRegNumber: e.target.value })}
                        className="mt-1"
                        data-testid="input-business-reg-number"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Tax ID / NIN</Label>
                      <Input
                        placeholder="Tax ID / NIN"
                        value={form.businessTaxId || ""}
                        onChange={(e) => setForm({ ...form, businessTaxId: e.target.value })}
                        className="mt-1"
                        data-testid="input-business-tax-id"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Bank Details Section */}
                <AccordionItem value="bank-details">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-medium">Bank Details</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label className="text-sm font-medium">Account Holder Name</Label>
                      <Input
                        placeholder="Account holder name"
                        value={form.bankAccountName || ""}
                        onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                        className="mt-1"
                        data-testid="input-bank-account-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Bank Name</Label>
                      <Input
                        placeholder="Bank name"
                        value={form.bankName || ""}
                        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                        className="mt-1"
                        data-testid="input-bank-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Account Number</Label>
                      <Input
                        placeholder="Account number"
                        value={form.bankAccountNumber || ""}
                        onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                        className="mt-1"
                        data-testid="input-bank-account-number"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Routing Number / Code</Label>
                      <Input
                        placeholder="Routing/Sort code"
                        value={form.bankRoutingNumber || ""}
                        onChange={(e) => setForm({ ...form, bankRoutingNumber: e.target.value })}
                        className="mt-1"
                        data-testid="input-bank-routing"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetAddForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createCompanyMutation.isPending}
              data-testid="button-create-company"
            >
              {createCompanyMutation.isPending ? "Saving..." : "Save Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Company Dialog */}
      <Dialog open={showViewCompany} onOpenChange={setShowViewCompany}>
        <DialogContent className="w-[60vw] max-w-none max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
          </DialogHeader>
          {selectedCompany && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                <div>
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <p className="font-semibold text-sm">{selectedCompany.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contact Email</Label>
                  <p className="text-sm">{selectedCompany.contactEmail || "â€”"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="text-sm">{selectedCompany.phone || "â€”"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Submitted At</Label>
                  <p className="text-sm">{formatDate(selectedCompany.submittedAt || selectedCompany.details?.submittedAt)}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm">{selectedCompany.description || "â€”"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <p className="text-sm">{selectedCompany.providerName || selectedCompany.provider_id || "â€”"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Active</Label>
                <div>
                  <Badge variant={selectedCompany.isActive ? "default" : "outline"} className="text-sm">
                    {typeof selectedCompany.isActive !== "undefined" ? (selectedCompany.isActive ? "Active" : "Inactive") : "â€”"}
                  </Badge>
                </div>
              </div>
              <div>
                <DetailsView data={selectedCompany.details} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatDate(selectedCompany.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Updated</Label>
                  <p className="text-sm">{formatDate(selectedCompany.updatedAt)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowViewCompany(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowViewCompany(false);
              handleEditCompany(selectedCompany);
            }}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={showEditCompany} onOpenChange={(open) => {
        if (!open) resetEditForm();
        else setShowEditCompany(true);
      }}>
        <DialogContent className="w-[60vw] max-w-none max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update company information.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Company Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-edit-company-name"
              />
              <p className="text-xs text-muted-foreground mt-1">Enter the legal or commonly used company name.</p>
            </div>
            <div>
              <Label className="text-xs">Contact Email</Label>
              <Input
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                data-testid="input-edit-company-email"
              />
              <p className="text-xs text-muted-foreground mt-1">Public email used for enquiries (e.g., info@company.com).</p>
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                data-testid="input-edit-company-phone"
              />
              <p className="text-xs text-muted-foreground mt-1">Primary contact number including country code if applicable.</p>
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                data-testid="textarea-edit-company-description"
              />
              <p className="text-xs text-muted-foreground mt-1">Short description about the company and services offered.</p>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="company-active"
                checked={!!form.isActive}
                onCheckedChange={(checked: any) => setForm({ ...form, isActive: !!checked })}
              />
              <Label htmlFor="company-active" className="text-sm">Active</Label>
            </div>

            {/* Business Registration Accordions */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <Accordion type="single" collapsible className="w-full">
                {/* Business Details Section */}
                <AccordionItem value="business-details">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-medium">Business Details</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label className="text-sm font-medium">Business Address</Label>
                      <Input
                        placeholder="Street address"
                        value={form.businessAddress || ""}
                        onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                        className="mt-1"
                        data-testid="input-edit-business-address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">City</Label>
                        <Input
                          placeholder="City"
                          value={form.businessCity || ""}
                          onChange={(e) => setForm({ ...form, businessCity: e.target.value })}
                          className="mt-1"
                          data-testid="input-edit-business-city"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">State/Province</Label>
                        <Input
                          placeholder="State/Province"
                          value={form.businessState || ""}
                          onChange={(e) => setForm({ ...form, businessState: e.target.value })}
                          className="mt-1"
                          data-testid="input-edit-business-state"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">ZIP Code</Label>
                        <Input
                          placeholder="ZIP/Postal code"
                          value={form.businessZipCode || ""}
                          onChange={(e) => setForm({ ...form, businessZipCode: e.target.value })}
                          className="mt-1"
                          data-testid="input-edit-business-zipcode"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Country</Label>
                        <Input
                          placeholder="Country"
                          value={form.businessCountry || ""}
                          onChange={(e) => setForm({ ...form, businessCountry: e.target.value })}
                          className="mt-1"
                          data-testid="input-edit-business-country"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Business Type</Label>
                      <Select value={form.businessType || ""} onValueChange={(value) => setForm({ ...form, businessType: value })}>
                        <SelectTrigger className="w-full mt-1" data-testid="select-edit-business-type">
                          <SelectValue placeholder="Select a business type" />
                        </SelectTrigger>
                        <SelectContent className="w-full">
                          {businessTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Registration & Compliance Section */}
                <AccordionItem value="registration-compliance">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-medium">Registration & Compliance</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label className="text-sm font-medium">Business Registration Number</Label>
                      <Input
                        placeholder="CAC/Registration number"
                        value={form.businessRegNumber || ""}
                        onChange={(e) => setForm({ ...form, businessRegNumber: e.target.value })}
                        className="mt-1"
                        data-testid="input-edit-business-reg-number"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Tax ID / NIN</Label>
                      <Input
                        placeholder="Tax ID / NIN"
                        value={form.businessTaxId || ""}
                        onChange={(e) => setForm({ ...form, businessTaxId: e.target.value })}
                        className="mt-1"
                        data-testid="input-edit-business-tax-id"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Bank Details Section */}
                <AccordionItem value="bank-details">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-medium">Bank Details</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label className="text-sm font-medium">Account Holder Name</Label>
                      <Input
                        placeholder="Account holder name"
                        value={form.bankAccountName || ""}
                        onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                        className="mt-1"
                        data-testid="input-edit-bank-account-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Bank Name</Label>
                      <Input
                        placeholder="Bank name"
                        value={form.bankName || ""}
                        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                        className="mt-1"
                        data-testid="input-edit-bank-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Account Number</Label>
                      <Input
                        placeholder="Account number"
                        value={form.bankAccountNumber || ""}
                        onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                        className="mt-1"
                        data-testid="input-edit-bank-account-number"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Routing Number / Code</Label>
                      <Input
                        placeholder="Routing/Sort code"
                        value={form.bankRoutingNumber || ""}
                        onChange={(e) => setForm({ ...form, bankRoutingNumber: e.target.value })}
                        className="mt-1"
                        data-testid="input-edit-bank-routing"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetEditForm}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateCompanyMutation.isPending}
              data-testid="button-update-company"
            >
              {updateCompanyMutation.isPending ? "Saving..." : "Update Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="w-[60vw] max-w-none max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedCompany?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteCompanyMutation.mutate()}
              disabled={deleteCompanyMutation.isPending}
              data-testid="button-confirm-delete-company"
            >
              {deleteCompanyMutation.isPending ? "Deleting..." : "Delete Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pending Company Approvals</CardTitle>
            <CardDescription>Verify companies before they become visible to providers.</CardDescription>
          </CardHeader>
          <CardContent>
            {isPendingCompaniesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-10 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            ) : !Array.isArray(pendingCompanies) || pendingCompanies.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                No companies awaiting verification.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCompanies.map((company: any) => (
                  <div
                    key={company.id || company._id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border rounded-lg p-3"
                  >
                    <div>
                      <div className="font-medium">{company.name || "Unnamed Company"}</div>
                      <div className="text-sm text-muted-foreground">
                        {company.contactEmail || "No contact email"} · {company.phone || "No phone"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Submitted: {company.createdAt ? new Date(company.createdAt).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => verifyCompanyMutation.mutate({ id: company.id || company._id, isActive: true })}
                        disabled={verifyCompanyMutation.isPending}
                        data-testid={`button-approve-company-${company.id || company._id}`}
                      >
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verifyCompanyMutation.mutate({ id: company.id || company._id, isActive: false })}
                        disabled={verifyCompanyMutation.isPending}
                        data-testid={`button-reject-company-${company.id || company._id}`}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>All Companies</CardTitle>
            <CardDescription>Companies available for provider assignment.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-10 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                No companies yet. Add one to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Contact</th>
                      <th className="px-4 py-2">Phone</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company: any) => (
                      <tr key={company.id} className="border-t border-border hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-4 py-3 font-medium">{company.name}</td>
                        <td className="px-4 py-3">{company.contactEmail || "â€”"}</td>
                        <td className="px-4 py-3">{company.phone || "â€”"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewCompany(company)}
                              data-testid={`button-view-company-${company.id}`}
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => goToCompanyMembers(company.id)}
                              data-testid={`button-company-members-${company.id}`}
                              title="Manage members"
                            >
                              <Users className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCompany(company)}
                              data-testid={`button-edit-company-${company.id}`}
                              title="Edit company"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCompany(company)}
                              data-testid={`button-delete-company-${company.id}`}
                              title="Delete company"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Stores Management Component
const StoresManagement: FC<{ companyIdOverride?: string; categoriesList?: any[] }> = ({ companyIdOverride, categoriesList: passedCategoriesList }) => {
    const [location, setLocation] = useLocation();
  const [locationPath, locationQuery] = location.split("?");
  const storeCompanyIdFromQuery = new URLSearchParams(locationQuery || "").get("companyId");
  const storeCompanyId = companyIdOverride || storeCompanyIdFromQuery;
    const [search, setSearch] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedStore, setSelectedStore] = useState<any>(null);
    const [selectedOwnerId, setSelectedOwnerId] = useState("");
    const [selectedCompanyId, setSelectedCompanyId] = useState("");
    const [formData, setFormData] = useState({
      name: "",
      description: "",
      location: "",
    phone: "",
    email: "",
  });
    // When creating/editing store: assignment can be 'global' or an estate id
    const [selectedStoreAssignment, setSelectedStoreAssignment] = useState<string | null>("global");
    // UI: tab to toggle between global stores and estate-specific stores
    const [storeTab, setStoreTab] = useState<"global" | "estate">("global");
    const [selectedEstateFilter, setSelectedEstateFilter] = useState<string | null>(null);

    // Fetch estates to populate estate selector when in 'estate' tab
    const { data: estatesForFilter = [] } = useQuery({
      queryKey: ["/api/admin/estates/list-for-stores"],
      queryFn: () => adminApiRequest("GET", "/api/admin/estates"),
    });

    const { data: companies = [] } = useQuery({
      queryKey: ["admin-companies"],
      queryFn: () => adminApiRequest("GET", "/api/admin/companies"),
    });

  const { user } = useAdminAuth();
  const { toast } = useToast();

    useEffect(() => {
      if (storeCompanyId) {
        setSelectedCompanyId(String(storeCompanyId));
      }
    }, [storeCompanyId]);

    const includeUnassignedStores = Boolean(companyIdOverride);
    const { data: stores, isLoading } = useQuery({
      queryKey: ["/api/admin/stores", { search, companyId: storeCompanyId, includeUnassignedStores }],
      queryFn: () => {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (storeCompanyId) params.append("companyId", storeCompanyId);
        if (includeUnassignedStores) params.append("includeUnassigned", "true");
        const queryString = params.toString();
        return adminApiRequest(
          "GET",
          `/api/admin/stores${queryString ? "?" + queryString : ""}`,
        );
      },
    });

    const storeCompany = storeCompanyId && Array.isArray(companies)
      ? companies.find((company: any) => String(company.id || company._id) === String(storeCompanyId))
      : null;
    const selectedCompany = !storeCompanyId && selectedCompanyId && Array.isArray(companies)
      ? companies.find((company: any) => String(company.id || company._id) === String(selectedCompanyId))
      : null;
    const effectiveCompany = storeCompany || selectedCompany;
    // When viewing company-scoped stores, filter by companyId. But also include stores that 
    // were just created (which may not have companyId set in DB yet)
    const scopedStores = storeCompanyId && Array.isArray(stores)
      ? stores.filter((store: any) => {
          // Include if companyId matches
          if (String(store.companyId || store.company_id) === String(storeCompanyId)) {
            return true;
          }
          // Include if store was just created in this company context (no companyId yet)
          // by checking if ownerId matches a provider from this company
          if (!store.companyId && !store.company_id) {
            return true;
          }
          return false;
        })
      : stores;

    // derive filtered stores according to selected tab
    const filteredStores = Array.isArray(scopedStores)
      ? scopedStores.filter((s: any) => {
          if (storeTab === "global") return !s.estateId && !s.estate_id;
          // estate tab: filter by selectedEstateFilter (if set), else show none
          if (storeTab === "estate") {
            if (!selectedEstateFilter) return false;
            return String(s.estateId || s.estate_id || "") === String(selectedEstateFilter);
          }
          return true;
        })
      : [];
    const inventoryStoreId = (() => {
      const segments = location.split("/").filter(Boolean);
      if (
        segments[0] === "admin-dashboard" &&
        segments[1] === "stores" &&
        segments[2] === "inventory"
      ) {
        return segments[3] || null;
      }
      if (
        segments[0] === "admin-dashboard" &&
        segments[1] === "companies" &&
        segments[2] === "stores" &&
        segments[3] &&
        segments[4] === "inventory"
      ) {
        return segments[5] || null;
      }
      return null;
    })();
    const storeMembersStoreId = (() => {
      const segments = location.split("/").filter(Boolean);
      if (
        segments[0] === "admin-dashboard" &&
        segments[1] === "stores" &&
        segments[2] === "members"
      ) {
        return segments[3] || null;
      }
      if (
        segments[0] === "admin-dashboard" &&
        segments[1] === "companies" &&
        segments[2] === "stores" &&
        segments[3] &&
        segments[4] === "members"
      ) {
        return segments[5] || null;
      }
      return null;
    })();
    const storeMembersStore =
      storeMembersStoreId && Array.isArray(stores)
        ? stores.find((store: any) => (store._id || store.id) === storeMembersStoreId)
        : null;
    const inventoryStore =
      inventoryStoreId && Array.isArray(stores)
        ? stores.find((store: any) => (store._id || store.id) === inventoryStoreId)
        : null;
    const isInventoryPage = Boolean(inventoryStoreId);
    const isStoreMembersPage = Boolean(storeMembersStoreId);
    const [inventoryView, setInventoryView] = useState<"card" | "table">("table");
    const isEmbeddedCompanyStores = Boolean(companyIdOverride);
    const storesBasePath = isEmbeddedCompanyStores
      ? `/admin-dashboard/companies/stores/${encodeURIComponent(String(storeCompanyId))}`
      : "/admin-dashboard/stores";
    const withCompanyQuery = (path: string) =>
      storeCompanyId ? `${path}?companyId=${encodeURIComponent(String(storeCompanyId))}` : path;
    const goToStores = () =>
      setLocation(isEmbeddedCompanyStores ? storesBasePath : withCompanyQuery(storesBasePath));
    const goToStoreMembers = (storeId: string) => {
      if (isEmbeddedCompanyStores) {
        setLocation(`${storesBasePath}/members/${storeId}`);
        return;
      }
      setLocation(withCompanyQuery(`/admin-dashboard/stores/members/${storeId}`));
    };

  const { data: storeProviders } = useQuery({
    queryKey: ["/api/admin/store-owner-providers"],
    queryFn: () =>
      adminApiRequest("GET", "/api/admin/users/all", {
        role: "provider",
      }),
  });

  const companyMatchesProvider = (provider: any, company: any) => {
    if (!provider || !company) return false;
    // Get company value from provider (try multiple field names)
    const providerCompanyValue = provider.company || provider.companyId || provider.company_id;
    if (!providerCompanyValue) return false;
    // If it's an object, extract the id
    const providerCompanyId = typeof providerCompanyValue === 'object'
      ? (providerCompanyValue.id || providerCompanyValue._id)
      : providerCompanyValue;
    const providerCompanyStr = String(providerCompanyId || "").trim().toLowerCase();
    const companyName = String(company.name || "").trim().toLowerCase();
    const companyId = String(company.id || company._id || "").trim().toLowerCase();
    return providerCompanyStr === companyName || providerCompanyStr === companyId;
  };

  const scopedStoreProviders = Array.isArray(storeProviders)
    ? (effectiveCompany ? storeProviders.filter((provider: any) => companyMatchesProvider(provider, effectiveCompany)) : storeProviders)
    : [];

  // Auto-fill phone/email when a store owner is selected
  useEffect(() => {
    if (!selectedOwnerId || !Array.isArray(scopedStoreProviders)) return;
    const owner = scopedStoreProviders.find(
      (p: any) => (p.id || p._id) === selectedOwnerId,
    );
    if (!owner) return;

    setFormData((prev) => {
      const nextPhone = owner.phone || prev.phone || "";
      const nextEmail = owner.email || prev.email || "";

      // Avoid triggering a new render if nothing actually changed
      if (prev.phone === nextPhone && prev.email === nextEmail) {
        return prev;
      }

      return {
        ...prev,
        phone: nextPhone,
        email: nextEmail,
      };
    });
  }, [selectedOwnerId, scopedStoreProviders]);

  const createStoreMutation = useMutation({
    mutationFn: ({ payload, id }: { payload: any; id?: string }) => {
      if (id) {
        return adminApiRequest("PATCH", `/api/admin/stores/${id}`, payload);
      }
      return adminApiRequest("POST", "/api/admin/stores", payload);
    },
    onSuccess: (data, variables) => {
      // Invalidate all stores queries (both with and without filters)
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stores"] });
      
      // If creating a new store (not editing), manually add it to the cache for immediate display
      if (!variables.id) {
        queryClient.setQueryData(
          ["/api/admin/stores", { search: "", companyId: storeCompanyId, includeUnassignedStores }],
          (oldData: any[]) => {
            if (!Array.isArray(oldData)) return [data];
            return [...oldData, data];
          }
        );
      }
      
      setIsCreateDialogOpen(false);
      setFormData({ name: "", description: "", location: "", phone: "", email: "" });
      setSelectedOwnerId("");
      setSelectedStoreAssignment("global");
      setSelectedStore(null);
      setSelectedCompanyId(storeCompanyId ? String(storeCompanyId) : "");
      toast({ title: variables.id ? "Store updated successfully" : "Store created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving store",
        description: error.response?.data?.error || "Failed to save store",
        variant: "destructive",
      });
    },
    });
  
    // Inventory per store
    const { data: inventoryItems = [], refetch: refetchInventory } = useQuery({
      queryKey: ["/api/admin/marketplace", { storeId: inventoryStoreId }],
      queryFn: () =>
        inventoryStoreId
          ? adminApiRequest("GET", "/api/admin/marketplace", {
              storeId: inventoryStoreId,
            })
          : [],
      enabled: !!inventoryStoreId,
    });
    const { data: storeMembers = [], isLoading: isStoreMembersLoading } = useQuery({
      queryKey: ["/api/admin/stores", storeMembersStoreId, "members"],
      queryFn: () =>
        storeMembersStoreId
          ? adminApiRequest("GET", `/api/admin/stores/${storeMembersStoreId}/members`)
          : [],
      enabled: !!storeMembersStoreId,
    });
    const { data: storeMemberInventory = [] } = useQuery({
      queryKey: ["/api/admin/marketplace", { storeId: storeMembersStoreId, view: "members" }],
      queryFn: () =>
        storeMembersStoreId
          ? adminApiRequest("GET", "/api/admin/marketplace", {
              storeId: storeMembersStoreId,
            })
          : [],
      enabled: !!storeMembersStoreId,
    });
    const { data: storeOrdersResponse } = useQuery({
      queryKey: ["/api/admin/orders", { storeId: storeMembersStoreId }],
      queryFn: () =>
        adminApiRequest("GET", "/api/admin/orders", {
          limit: 50,
        }),
      enabled: !!storeMembersStoreId,
    });
    const [newStoreMember, setNewStoreMember] = useState({
      userId: "",
      role: "member",
      canManageItems: true,
      canManageOrders: true,
      isActive: true,
    });
    const addStoreMemberMutation = useMutation({
      mutationFn: (payload: typeof newStoreMember) =>
        adminApiRequest("POST", `/api/admin/stores/${storeMembersStoreId}/members`, payload),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/stores", storeMembersStoreId, "members"],
        });
        setNewStoreMember({
          userId: "",
          role: "member",
          canManageItems: true,
          canManageOrders: true,
          isActive: true,
        });
        toast({ title: "Store member added" });
      },
      onError: (error: any) => {
        toast({
          title: "Failed to add member",
          description: error.response?.data?.message || "Unable to add member.",
          variant: "destructive",
        });
      },
    });
    const updateStoreMemberMutation = useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: any }) =>
        adminApiRequest(
          "PATCH",
          `/api/admin/stores/${storeMembersStoreId}/members/${id}`,
          updates,
        ),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/stores", storeMembersStoreId, "members"],
        });
        toast({ title: "Member updated" });
      },
      onError: (error: any) => {
        toast({
          title: "Failed to update member",
          description: error.response?.data?.message || "Unable to update member.",
          variant: "destructive",
        });
      },
    });
    const removeStoreMemberMutation = useMutation({
      mutationFn: (memberId: string) =>
        adminApiRequest(
          "DELETE",
          `/api/admin/stores/${storeMembersStoreId}/members/${memberId}`,
        ),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/stores", storeMembersStoreId, "members"],
        });
        toast({ title: "Member removed" });
      },
      onError: (error: any) => {
        toast({
          title: "Failed to remove member",
          description: error.response?.data?.message || "Unable to remove member.",
          variant: "destructive",
        });
      },
    });
    const [memberTasks, setMemberTasks] = useState<any[]>([]);
    const [memberTaskForm, setMemberTaskForm] = useState({
      title: "",
      description: "",
      assigneeId: "",
      priority: "medium",
      status: "open",
      dueDate: "",
    });
    useEffect(() => {
      if (!storeMembersStoreId) return;
      const key = `store-members:${storeMembersStoreId}:tasks`;
      const saved = window.localStorage.getItem(key);
      setMemberTasks(saved ? JSON.parse(saved) : []);
    }, [storeMembersStoreId]);
    useEffect(() => {
      if (!storeMembersStoreId) return;
      const key = `store-members:${storeMembersStoreId}:tasks`;
      window.localStorage.setItem(key, JSON.stringify(memberTasks));
    }, [memberTasks, storeMembersStoreId]);

    const inventoryForm = useForm({
      defaultValues: {
        name: "",
        price: "",
        stock: "",
        category: "",
        description: "",
        vendorId: "",
        images: [] as string[],
      },
    });
    const inventoryImageInputRef = useRef<HTMLInputElement | null>(null);
    const [inventoryImagePreview, setInventoryImagePreview] = useState<string[]>([]);
    const inventoryEditForm = useForm({
      defaultValues: {
        name: "",
        price: 0,
        stock: 0,
        category: "",
        description: "",
        image: "",
      },
    });
    const [inventoryEditPreview, setInventoryEditPreview] = useState<string>("");
    const [inventoryEditImages, setInventoryEditImages] = useState<string[]>([]);
    const [editImageIndex, setEditImageIndex] = useState<number>(0);
    const [inventoryEditingItem, setInventoryEditingItem] = useState<any | null>(null);
    const [deletingInventoryId, setDeletingInventoryId] = useState<string | null>(null);
    const [isAddInventoryModalOpen, setIsAddInventoryModalOpen] = useState<boolean>(false);
    const [viewInventoryItem, setViewInventoryItem] = useState<any | null>(null);
    const [viewImageIndex, setViewImageIndex] = useState<number>(0);

    const getPrimaryImage = useCallback((item?: any) => {
      if (!item) return "";
      if (Array.isArray(item?.images) && item.images.length > 0) {
        return item.images[0];
      }
      if (typeof item?.image === "string" && item.image.length > 0) {
        return item.image;
      }
      return "";
    }, []);
    const getGalleryImages = useCallback((item?: any) => {
      if (!item) return [];
      if (Array.isArray(item.images) && item.images.length > 0) {
        return item.images.filter(Boolean);
      }
      if (item.image) return [item.image];
      return [];
    }, []);

    const { data: itemCategories = [] } = useQuery({
      queryKey: ["/api/admin/item-categories"],
      queryFn: () => adminApiRequest("GET", "/api/admin/item-categories"),
      enabled: isInventoryPage,
    });
    useEffect(() => {
      if (!isInventoryPage) return;
      if (!inventoryForm.getValues("category") && Array.isArray(itemCategories) && itemCategories.length > 0) {
        inventoryForm.setValue("category", itemCategories[0].name);
      }
    }, [itemCategories, isInventoryPage]);
    useEffect(() => {
      if (!isInventoryPage) return;
      if (!inventoryEditingItem) {
        inventoryEditForm.reset({
          name: "",
          price: 0,
          stock: 0,
          description: "",
          category: itemCategories?.[0]?.name || "",
          image: "",
        });
        setInventoryEditPreview("");
        setInventoryEditImages([]);
        setEditImageIndex(0);
        return;
      }
      const primaryImage = getPrimaryImage(inventoryEditingItem);
      inventoryEditForm.reset({
        name: inventoryEditingItem.name || "",
        price: Number(inventoryEditingItem.price || 0),
        stock: Number(inventoryEditingItem.stock - 0),
        description: inventoryEditingItem.description || "",
        category: inventoryEditingItem.category || itemCategories?.[0]?.name || "",
        image: primaryImage,
      });
      setInventoryEditPreview(primaryImage);
      setInventoryEditImages(getGalleryImages(inventoryEditingItem));
      setEditImageIndex(0);
    }, [inventoryEditingItem, itemCategories, getPrimaryImage, getGalleryImages, isInventoryPage]);

    const createInventoryMutation = useMutation({
      mutationFn: (payload: any) =>
        adminApiRequest("POST", "/api/admin/marketplace", payload),
      onSuccess: () => {
        refetchInventory();
        inventoryForm.reset();
        setInventoryImagePreview([]);
        toast({ title: "Inventory item added" });
      },
      onError: (error: any) => {
        toast({
          title: "Error adding inventory",
        description: error.response?.data?.error || "Failed to add item",
        variant: "destructive",
      });
    },
  });
    const closeInventoryEditDialog = useCallback(() => {
      setInventoryEditingItem(null);
      setInventoryEditPreview("");
      setInventoryEditImages([]);
      setEditImageIndex(0);
      inventoryEditForm.reset({
        name: "",
        price: 0,
        stock: 0,
        description: "",
        category: itemCategories?.[0]?.name || "",
        image: "",
      });
    }, [itemCategories]);

    const updateInventoryMutation = useMutation({
      mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
        adminApiRequest("PATCH", `/api/admin/marketplace/${id}`, data),
      onSuccess: () => {
        refetchInventory();
        toast({ title: "Inventory item updated" });
        closeInventoryEditDialog();
        inventoryEditForm.reset();
      },
      onError: (error: any) => {
        toast({
          title: "Error updating inventory",
          description: error.response?.data?.error || "Failed to update item",
          variant: "destructive",
        });
      },
    });

    const deleteInventoryMutation = useMutation({
      mutationFn: (id: string) => adminApiRequest("DELETE", `/api/admin/marketplace/${id}`),
      onSuccess: () => {
        refetchInventory();
        toast({ title: "Inventory item deleted" });
      },
      onError: (error: any) => {
        toast({
          title: "Error deleting inventory",
          description: error.response?.data?.error || "Failed to delete item",
          variant: "destructive",
        });
      },
    });

    const handleDeleteInventoryItem = (item: any) => {
      const itemId = item?._id || item?.id;
      if (!itemId) {
        toast({
          title: "Unable to delete item",
          description: "Missing identifier for this inventory entry.",
          variant: "destructive",
        });
        return;
      }
      const shouldDelete = confirm(
        `Delete ${item.name || "this item"} from ${inventoryStore?.name || "inventory"}?`,
      );
      if (!shouldDelete) return;
      setDeletingInventoryId(itemId);
      deleteInventoryMutation.mutate(itemId, {
        onSettled: () => setDeletingInventoryId(null),
      });
    };

    const handleSubmit = () => {
    if (!formData.name || !formData.location) {
      toast({
        title: "Validation Error",
        description: "Name and location are required",
        variant: "destructive",
      });
      return;
    }

    const companyIdValue =
      storeCompanyId ||
      selectedCompanyId ||
      selectedStore?.companyId ||
      selectedStore?.company_id;
    if (!companyIdValue) {
      toast({
        title: "Select a company",
        description: "Choose which company this store belongs to.",
        variant: "destructive",
      });
      return;
    }

    const storeId = selectedStore?._id || selectedStore?.id;
    const resolvedOwnerId = selectedOwnerId || selectedStore?.ownerId || selectedStore?.owner_id;
    if (!resolvedOwnerId) {
      toast({ title: "Select a store owner", description: "Assign a provider as the store owner.", variant: "destructive" });
      return;
    }
    const payload: any = {
      ...formData,
      ownerId: resolvedOwnerId,
      companyId: companyIdValue,
    };
    // include estate assignment when set; for edits, explicitly clear with null when switching to global
    if (selectedStoreAssignment && selectedStoreAssignment !== "global") {
      payload.estateId = selectedStoreAssignment;
    } else if (storeId) {
      // editing an existing store and user chose global: clear estate assignment
      payload.estateId = null;
    }
    createStoreMutation.mutate({ payload, id: storeId });
  };


  if (isStoreMembersPage) {
    const memberRows = Array.isArray(storeMembers) ? storeMembers : [];
    const storeMembersCompanyId = storeMembersStore?.companyId || storeMembersStore?.company_id || "";
    const storeMembersCompany = storeMembersCompanyId && Array.isArray(companies)
      ? companies.find((company: any) => String(company.id || company._id) === String(storeMembersCompanyId))
      : null;
    const providerList = Array.isArray(scopedStoreProviders)
      ? (storeMembersCompany ? scopedStoreProviders.filter((provider: any) => companyMatchesProvider(provider, storeMembersCompany)) : scopedStoreProviders)
      : [];
    const storeOwnerId = storeMembersStore?.ownerId || storeMembersStore?.owner_id || "";
    const storeOwnerUser = providerList.find(
      (provider: any) => String(provider.id || provider._id) === String(storeOwnerId),
    );
    const storeOwnerEligible = !!storeOwnerUser;
    const membersWithOwner = storeOwnerId && storeOwnerEligible && !memberRows.some(
      (member: any) => String(member.userId || member.user?.id || "") === String(storeOwnerId),
    )
      ? [
          {
            id: `owner-${storeOwnerId}`,
            userId: storeOwnerId,
            role: "owner",
            canManageItems: true,
            canManageOrders: true,
            isActive: true,
            user: storeOwnerUser
              ? {
                  id: storeOwnerUser.id || storeOwnerUser._id,
                  name: storeOwnerUser.name,
                  email: storeOwnerUser.email,
                  phone: storeOwnerUser.phone,
                  role: storeOwnerUser.role,
                  isActive: storeOwnerUser.isActive,
                }
              : undefined,
            isStoreOwner: true,
          },
          ...memberRows,
        ]
      : memberRows.map((member: any) => ({
          ...member,
          isStoreOwner:
            storeOwnerEligible &&
            String(member.userId || member.user?.id || "") === String(storeOwnerId),
        }));
    const availableProviders = providerList.filter((provider: any) => {
      const providerId = provider.id || provider._id;
      return !memberRows.some((member: any) => (member.userId || member.user?.id) === providerId);
    });
    const orders = Array.isArray(storeOrdersResponse?.data) ? storeOrdersResponse.data : [];
    const storeOrders = orders.filter(
      (order: any) =>
        String(order.storeId || order.store_id || "") === String(storeMembersStoreId),
    );
    const inventoryActivityItems = Array.isArray(storeMemberInventory) ? storeMemberInventory : [];
    const activityEvents = [
      ...storeOrders.map((order: any) => ({
        id: `order-${order.id}`,
        type: "order",
        title: `Order ${String(order.id || "").slice(-6)}`,
        meta: `${order.status || "Pending"}`,
        amount: `${order.currency || "NGN"} ${Number(order.total || 0).toLocaleString()}`,
        createdAt: order.createdAt || order.created_at,
      })),
      ...inventoryActivityItems.map((item: any) => ({
        id: `inventory-${item.id}`,
        type: "inventory",
        title: item.name || "Inventory update",
        meta: item.updatedAt ? "Updated" : "Added",
        amount: `${item.currency || "NGN"} ${Number(item.price || 0).toLocaleString()}`,
        createdAt: item.updatedAt || item.createdAt,
      })),
    ].sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return right - left;
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" className="px-0" onClick={goToStores}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Stores
            </Button>
            <span>/ Stores</span>
            {storeMembersStore?.name ? <span>/ {storeMembersStore.name}</span> : null}
            <span>/ Members</span>
          </div>
          <div className="flex items-center gap-2">
            {storeMembersStoreId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/admin-dashboard/stores/inventory/${storeMembersStoreId}`)}
              >
                View Inventory
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Members</p>
              <p className="text-2xl font-semibold">{memberRows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Active Members</p>
              <p className="text-2xl font-semibold">
                {memberRows.filter((m: any) => m.isActive !== false).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Open Tasks</p>
              <p className="text-2xl font-semibold">
                {memberTasks.filter((t) => t.status !== "done").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Recent Orders</p>
              <p className="text-2xl font-semibold">{storeOrders.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Store Members</CardTitle>
                  <CardDescription>Manage access, roles, and permissions for this store.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <div>
                  <Label className="text-xs font-medium">Member</Label>
                  <Select
                    value={newStoreMember.userId}
                    onValueChange={(value) => setNewStoreMember((prev) => ({ ...prev, userId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProviders.length > 0 ? (
                        availableProviders.map((provider: any) => (
                          <SelectItem key={provider.id || provider._id} value={provider.id || provider._id}>
                            {provider.name} ({provider.email})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          All providers already assigned
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Role</Label>
                  <Select
                    value={newStoreMember.role}
                    onValueChange={(value) => setNewStoreMember((prev) => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newStoreMember.canManageItems}
                    onCheckedChange={(checked) =>
                      setNewStoreMember((prev) => ({
                        ...prev,
                        canManageItems: checked === true,
                      }))
                    }
                  />
                  <span className="text-xs text-muted-foreground">Items</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newStoreMember.canManageOrders}
                    onCheckedChange={(checked) =>
                      setNewStoreMember((prev) => ({
                        ...prev,
                        canManageOrders: checked === true,
                      }))
                    }
                  />
                  <span className="text-xs text-muted-foreground">Orders</span>
                </div>
                <div className="flex items-center">
                  <Button
                    disabled={!newStoreMember.userId || addStoreMemberMutation.isPending}
                    onClick={() => addStoreMemberMutation.mutate(newStoreMember)}
                  >
                    {addStoreMemberMutation.isPending ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>

              {isStoreMembersLoading ? (
                <div className="text-sm text-muted-foreground">Loading members...</div>
              ) : memberRows.length === 0 ? (
                <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No members assigned to this store yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-4 py-2 font-medium">Member</th>
                        <th className="px-4 py-2 font-medium">Role</th>
                        <th className="px-4 py-2 font-medium">Permissions</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {membersWithOwner.map((member: any) => {
                        const memberId = member.id;
                        const userInfo = member.user || {};
                        const isStoreOwner = member.isStoreOwner;
                        return (
                          <tr key={memberId} className="border-t border-border">
                            <td className="px-4 py-3">
                              <div className="font-medium">{userInfo.name || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">{userInfo.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              {isStoreOwner ? (
                                <Badge variant="default">Store owner</Badge>
                              ) : (
                                <Select
                                  value={member.role}
                                  onValueChange={(value) =>
                                    updateStoreMemberMutation.mutate({
                                      id: memberId,
                                      updates: { role: value },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="owner">Owner</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={member.canManageItems}
                                    onCheckedChange={(checked) =>
                                      updateStoreMemberMutation.mutate({
                                        id: memberId,
                                        updates: { canManageItems: checked === true },
                                      })
                                    }
                                    disabled={isStoreOwner}
                                  />
                                  <span className="text-xs text-muted-foreground">Items</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={member.canManageOrders}
                                    onCheckedChange={(checked) =>
                                      updateStoreMemberMutation.mutate({
                                        id: memberId,
                                        updates: { canManageOrders: checked === true },
                                      })
                                    }
                                    disabled={isStoreOwner}
                                  />
                                  <span className="text-xs text-muted-foreground">Orders</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={member.isActive ? "default" : "secondary"}>
                                {member.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateStoreMemberMutation.mutate({
                                      id: memberId,
                                      updates: { isActive: !member.isActive },
                                    })
                                  }
                                  disabled={isStoreOwner}
                                >
                                  {member.isActive ? "Disable" : "Enable"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeStoreMemberMutation.mutate(memberId)}
                                  disabled={isStoreOwner}
                                >
                                  Remove
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Feed</CardTitle>
                <CardDescription>Recent activity tied to this store.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activityEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity found.</p>
                ) : (
                  activityEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{event.meta}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{event.amount}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.createdAt ? new Date(event.createdAt).toLocaleString() : "â€”"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task Allocation</CardTitle>
                <CardDescription>Assign tasks and track their progress.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Task title</Label>
                  <Input
                    value={memberTaskForm.title}
                    onChange={(e) => setMemberTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Update item listings"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Description</Label>
                  <Textarea
                    rows={3}
                    value={memberTaskForm.description}
                    onChange={(e) => setMemberTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the task details"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium">Assign to</Label>
                    <Select
                      value={memberTaskForm.assigneeId}
                      onValueChange={(value) => setMemberTaskForm((prev) => ({ ...prev, assigneeId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {memberRows.map((member: any) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.user?.name || "Member"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Priority</Label>
                    <Select
                      value={memberTaskForm.priority}
                      onValueChange={(value) => setMemberTaskForm((prev) => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium">Due date</Label>
                    <Input
                      type="date"
                      value={memberTaskForm.dueDate}
                      onChange={(e) => setMemberTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Status</Label>
                    <Select
                      value={memberTaskForm.status}
                      onValueChange={(value) => setMemberTaskForm((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!memberTaskForm.title || !memberTaskForm.assigneeId) {
                      toast({
                        title: "Missing task details",
                        description: "Provide a title and assignee before creating a task.",
                        variant: "destructive",
                      });
                      return;
                    }
                    const newTask = {
                      id: `${Date.now()}`,
                      ...memberTaskForm,
                      createdAt: new Date().toISOString(),
                    };
                    setMemberTasks((prev) => [newTask, ...prev]);
                    setMemberTaskForm({
                      title: "",
                      description: "",
                      assigneeId: "",
                      priority: "medium",
                      status: "open",
                      dueDate: "",
                    });
                  }}
                >
                  Assign Task
                </Button>

                <div className="space-y-3 pt-2">
                  {memberTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
                  ) : (
                    memberTasks.map((task) => {
                      const assignee = memberRows.find((m: any) => m.id === task.assigneeId);
                      return (
                        <div key={task.id} className="rounded border p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{task.title}</p>
                            <Badge variant={task.status === "done" ? "default" : "secondary"}>
                              {task.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{assignee?.user?.name || "Unassigned"}</span>
                            <span>{task.dueDate || "No due date"}</span>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setMemberTasks((prev) =>
                                  prev.map((item) =>
                                    item.id === task.id
                                      ? { ...item, status: item.status === "done" ? "open" : "done" }
                                      : item,
                                  ),
                                );
                              }}
                            >
                              {task.status === "done" ? "Reopen" : "Mark done"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setMemberTasks((prev) => prev.filter((item) => item.id !== task.id))}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isInventoryPage) {
    const hasInventoryItems = Array.isArray(inventoryItems) && inventoryItems.length > 0;
    const formatPrice = (item: any) =>
      `${item.currency || "NGN"} ${Number(item.price || 0).toLocaleString()}`;
    const renderItemImage = (src?: string, label?: string) =>
      src ? (
        <img
          src={src}
          alt={label || "Inventory item"}
          className="h-14 w-14 rounded-md object-cover border"
        />
      ) : (
        <div className="h-14 w-14 rounded-md border flex items-center justify-center text-xs font-semibold text-muted-foreground bg-muted/50">
          {(label || "?").slice(0, 2).toUpperCase()}
        </div>
      );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" className="px-0" onClick={goToStores}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Stores
            </Button>
            <span>/ Stores</span>
            {inventoryStore?.name ? <span>/ {inventoryStore.name}</span> : null}
            <span>/ Add Inventory</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation("/admin-dashboard/item-categories")}>
              Manage Categories
            </Button>
            <Button variant="outline" size="sm" onClick={goToStores}>
              Store Management
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Inventory - {inventoryStore?.name || "Store"}</CardTitle>
                <CardDescription>
                  Add and manage items for this store. Items will appear in the marketplace for residents.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={inventoryView === "card" ? "default" : "outline"}
                  onClick={() => setInventoryView("card")}
                >
                  Card View
                </Button>
                <Button
                  size="sm"
                  variant={inventoryView === "table" ? "default" : "outline"}
                  onClick={() => setInventoryView("table")}
                >
                  Table View
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="lg:col-span-2 space-y-4">
                {hasInventoryItems ? (
                  inventoryView === "table" ? (
                    <div className="overflow-x-auto rounded border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr className="text-left">
                            <th className="px-4 py-2 font-medium">Item</th>
                            <th className="px-4 py-2 font-medium">Category</th>
                            <th className="px-4 py-2 font-medium">Price & Stock</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryItems.map((item: any) => {
                            const itemId = item._id || item.id;
                            const primaryImage = getPrimaryImage(item);
                            const isDeleting = deletingInventoryId === itemId;
                            return (
                              <tr key={itemId} className="border-t border-border">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    {renderItemImage(primaryImage, item.name)}
                                    <div>
                                      <div className="font-semibold">{item.name}</div>
                                      <p className="text-xs text-muted-foreground max-w-xs">
                                        {item.description || "No description"}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">{item.category || "â€”"}</td>
                                <td className="px-4 py-3">
                                  <div className="font-medium">{formatPrice(item)}</div>
                                  <div className="text-xs text-muted-foreground">Stock: {item.stock - 0}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant={item.isActive ? "default" : "secondary"}>
                                    {item.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => {
                                            setViewInventoryItem(item);
                                            setViewImageIndex(0);
                                          }}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View item</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => setInventoryEditingItem(item)}
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit item</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handleDeleteInventoryItem(item)}
                                          disabled={isDeleting}
                                        >
                                          {isDeleting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete item</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {inventoryItems.map((item: any) => {
                        const itemId = item._id || item.id;
                        const primaryImage = getPrimaryImage(item);
                        const isDeleting = deletingInventoryId === itemId;
                        return (
                          <Card key={itemId} className="border border-border">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center gap-3">
                                {renderItemImage(primaryImage, item.name)}
                                <div>
                                  <div className="font-semibold">{item.name}</div>
                                  <p className="text-sm text-muted-foreground">
                                    {item.description || "No description"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{formatPrice(item)}</span>
                                <span className="text-muted-foreground">Stock: {item.stock - 0}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <Badge variant={item.isActive ? "default" : "secondary"}>
                                  {item.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <div className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          setViewInventoryItem(item);
                                          setViewImageIndex(0);
                                        }}
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View item</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setInventoryEditingItem(item)}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit item</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleDeleteInventoryItem(item)}
                                        disabled={isDeleting}
                                      >
                                        {isDeleting ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete item</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground border border-dashed rounded p-6 text-center">
                    No inventory yet. Add your first product using the form on the right.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {inventoryStoreId ? "Add products to manage your store inventory" : "Select a store to add items"}
                </div>
                <Button
                  onClick={() => setIsAddInventoryModalOpen(true)}
                  disabled={!inventoryStoreId}
                  data-testid="button-create-marketplace-item"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
        <Dialog
          open={!!inventoryEditingItem}
          onOpenChange={(open) => {
            if (!open) {
              closeInventoryEditDialog();
            }
          }}
        >
          <DialogContent className="w-[70vw] max-w-5xl">
            <DialogHeader>
              <DialogTitle>Edit Inventory Item</DialogTitle>
              <DialogDescription>Update the product details shown to residents.</DialogDescription>
            </DialogHeader>
            <Form {...inventoryEditForm}>
              <form
                className="grid gap-6 md:grid-cols-[1.2fr_1fr]"
                onSubmit={inventoryEditForm.handleSubmit((values) => {
                  const itemId = inventoryEditingItem?._id || inventoryEditingItem?.id;
                  if (!itemId) {
                    toast({
                      title: "Cannot update item",
                      description: "Missing identifier for this inventory entry.",
                      variant: "destructive",
                    });
                    return;
                  }
                  updateInventoryMutation.mutate({
                    id: itemId,
                    name: values.name,
                    description: values.description,
                    category: values.category,
                    price: Number(values.price) || 0,
                    stock: Number(values.stock) || 0,
                    images:
                      inventoryEditImages.length > 0
                        ? inventoryEditImages
                        : values.image
                          ? [values.image]
                          : [],
                  });
                })}
              >
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-lg border bg-muted/20">
                    {(() => {
                      const gallery =
                        inventoryEditImages.length > 0
                          ? inventoryEditImages
                          : inventoryEditPreview
                            ? [inventoryEditPreview]
                            : [];
                      if (gallery.length === 0) {
                        return (
                          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                            No image
                          </div>
                        );
                      }
                      const current = gallery[Math.min(editImageIndex, gallery.length - 1)];
                      return (
                        <div className="relative">
                          <img
                            src={current}
                            alt="Preview"
                            className="w-full h-72 object-cover"
                          />
                          {gallery.length > 1 && (
                            <div className="absolute inset-0 flex items-center justify-between px-3">
                              <Button
                                size="icon"
                                variant="outline"
                                className="bg-white/70 backdrop-blur"
                                type="button"
                                onClick={() =>
                                  setEditImageIndex((prev) =>
                                    prev === 0 ? gallery.length - 1 : prev - 1,
                                  )
                                }
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="bg-white/70 backdrop-blur"
                                type="button"
                                onClick={() =>
                                  setEditImageIndex((prev) =>
                                    prev === gallery.length - 1 ? 0 : prev + 1,
                                  )
                                }
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  {(inventoryEditImages.length > 1 ||
                    (inventoryEditPreview && inventoryEditImages.length === 0)) && (
                    <div className="flex gap-2 overflow-auto">
                      {(inventoryEditImages.length > 0
                        ? inventoryEditImages
                        : inventoryEditPreview
                          ? [inventoryEditPreview]
                          : []
                      ).map((img, idx) => (
                        <div key={`${img}-${idx}`} className="relative group">
                          <button
                            type="button"
                            className={`h-16 w-20 rounded border ${
                              editImageIndex === idx ? "ring-2 ring-primary" : "border-muted"
                            } overflow-hidden`}
                            onClick={() => setEditImageIndex(idx)}
                          >
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          </button>
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute -right-2 -top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const next = (inventoryEditImages.length > 0
                                ? inventoryEditImages
                                : inventoryEditPreview
                                  ? [inventoryEditPreview]
                                  : []
                              ).filter((_, i) => i !== idx);
                              setInventoryEditImages(next);
                              setInventoryEditPreview(next[0] || "");
                              setEditImageIndex((current) =>
                                Math.max(0, Math.min(current, next.length - 1)),
                              );
                              inventoryEditForm.setValue(
                                "image",
                                next[0] ? next[0] : "",
                              );
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <FormField
                    control={inventoryEditForm.control}
                    name="image"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Image</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                            reader.onload = () => {
                              const result = reader.result as string;
                              const nextImages = [
                                result,
                                ...inventoryEditImages.filter((img) => img !== result),
                              ];
                              setInventoryEditPreview(result);
                              setInventoryEditImages(nextImages);
                              setEditImageIndex(0);
                              field.onChange(result);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-4">
                  <FormField
                    control={inventoryEditForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Item name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inventoryEditForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Describe this item" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={inventoryEditForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (NGN)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inventoryEditForm.control}
                      name="stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={inventoryEditForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={(val) => field.onChange(val)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(itemCategories) && itemCategories.length > 0 ? (
                              itemCategories
                                .filter((c: any) => c.isActive !== false)
                                .map((cat: any) => (
                                  <SelectItem key={cat.id} value={cat.name}>
                                    {cat.emoji ? `${cat.emoji} ` : ""}
                                    {cat.name}
                                  </SelectItem>
                                ))
                            ) : (
                              <SelectItem value="__none" disabled>
                                No categories. Create one first.
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeInventoryEditDialog}
                      disabled={updateInventoryMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateInventoryMutation.isPending}>
                      {updateInventoryMutation.isPending && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Save changes
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddInventoryModalOpen} onOpenChange={setIsAddInventoryModalOpen}>
          <DialogContent className="w-[60vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
              <DialogDescription>Add a new product to this store.</DialogDescription>
            </DialogHeader>
            <Form {...inventoryForm}>
              <form
                className="grid gap-6 md:grid-cols-[1.1fr_1.4fr]"
                onSubmit={inventoryForm.handleSubmit((values) => {
                  const images = Array.isArray(values.images) ? values.images : [];
                  if (images.length === 0) {
                    toast({
                      title: "Add at least one image",
                      description: "Upload 1â€“6 images before adding the item.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (images.length > 6) {
                    toast({
                      title: "Too many images",
                      description: "Maximum is 6 images per item.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!inventoryStoreId) {
                    toast({
                      title: "Select a store",
                      description: "Return to store management and pick a store first.",
                      variant: "destructive",
                    });
                    return;
                  }
                  createInventoryMutation.mutate({
                    name: values.name,
                    description: values.description,
                    category: values.category,
                    price: Number(values.price) || 0,
                    stock: Number(values.stock) || 0,
                    vendorId: inventoryStore?.ownerId || undefined,
                    storeId: inventoryStoreId,
                    estateId: inventoryStore?.estateId || undefined,
                    currency: "NGN",
                    images,
                  });
                  setIsAddInventoryModalOpen(false);
                  inventoryForm.reset();
                  setInventoryImagePreview([]);
                })}
              >
                <div className="space-y-4">
                  <FormItem>
                    <FormLabel>Item Image</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Upload 1â€“6 images. {Math.max(0, 6 - inventoryImagePreview.length)} remaining.
                        </p>
                        {inventoryImagePreview.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {inventoryImagePreview.map((src, index) => (
                              <div key={`${src}-${index}`} className="relative group">
                                <img
                                  src={src}
                                  alt={`Preview ${index + 1}`}
                                  className="h-28 w-full rounded border object-cover"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => {
                                    const next = inventoryImagePreview.filter((_, i) => i !== index);
                                    setInventoryImagePreview(next);
                                    inventoryForm.setValue("images", next);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Input
                          ref={inventoryImageInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            Promise.all(
                              files.map(
                                (file) =>
                                  new Promise<string>((resolve) => {
                                    const reader = new FileReader();
                                    reader.onload = () => resolve(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }),
                              ),
                            ).then((results) => {
                              const maxImages = 6;
                              const combined = [...inventoryImagePreview, ...results];
                              const trimmed = combined.slice(0, maxImages);
                              if (combined.length > maxImages) {
                                toast({
                                  title: "Image limit reached",
                                  description: "Only the first 6 images were kept.",
                                  variant: "destructive",
                                });
                              }
                              const next = trimmed;
                              setInventoryImagePreview(next);
                              inventoryForm.setValue("images", next);
                              if (inventoryImageInputRef.current) {
                                inventoryImageInputRef.current.value = "";
                              }
                            });
                          }}
                        />
                        {inventoryImagePreview.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => inventoryImageInputRef.current?.click()}
                          >
                            Upload more images
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>
                <div className="space-y-4">
                  <FormField
                    control={inventoryForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Item name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inventoryForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="What is this item?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={inventoryForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (NGN)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inventoryForm.control}
                      name="stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={inventoryForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(val) => field.onChange(val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(itemCategories) && itemCategories.length > 0 ? (
                              itemCategories
                                .filter((c: any) => c.isActive !== false)
                                .map((cat: any) => (
                                  <SelectItem key={cat.id} value={cat.name}>
                                    {cat.emoji ? `${cat.emoji} ` : ""}
                                    {cat.name}
                                  </SelectItem>
                                ))
                            ) : (
                              <SelectItem value="__none" disabled>
                                No categories. Create one first.
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsAddInventoryModalOpen(false);
                      inventoryForm.reset();
                      setInventoryImagePreview([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createInventoryMutation.isPending}
                    data-testid="btn-add-inventory-item"
                  >
                    {createInventoryMutation.isPending ? "Saving..." : "Add Item"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!viewInventoryItem}
          onOpenChange={(open) => {
            if (!open) {
              setViewInventoryItem(null);
              setViewImageIndex(0);
            }
          }}
        >
          <DialogContent className="w-[70vw] max-w-5xl">
            <DialogHeader>
              <DialogTitle>{viewInventoryItem?.name || "Inventory Item"}</DialogTitle>
              <DialogDescription>
                Quick view of this inventory item with images and key details.
              </DialogDescription>
            </DialogHeader>
            {viewInventoryItem && (
              <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-lg border bg-muted/20">
                    {getGalleryImages(viewInventoryItem).length > 0 ? (
                      <div className="relative">
                        <img
                          src={getGalleryImages(viewInventoryItem)[viewImageIndex] || ""}
                          alt={viewInventoryItem.name || "Inventory image"}
                          className="w-full h-72 object-cover"
                        />
                        {getGalleryImages(viewInventoryItem).length > 1 && (
                          <div className="absolute inset-0 flex items-center justify-between px-3">
                            <Button
                              size="icon"
                              variant="outline"
                              className="bg-white/70 backdrop-blur"
                              onClick={() =>
                                setViewImageIndex((prev) =>
                                  prev === 0
                                    ? getGalleryImages(viewInventoryItem).length - 1
                                    : prev - 1,
                                )
                              }
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="bg-white/70 backdrop-blur"
                              onClick={() =>
                                setViewImageIndex((prev) =>
                                  prev === getGalleryImages(viewInventoryItem).length - 1
                                    ? 0
                                    : prev + 1,
                                )
                              }
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                        No images
                      </div>
                    )}
                  </div>
                  {getGalleryImages(viewInventoryItem).length > 1 && (
                    <div className="flex gap-2 overflow-auto">
                      {getGalleryImages(viewInventoryItem).map((img: string, idx: number) => (
                        <button
                          key={`${img}-${idx}`}
                          type="button"
                          className={`h-16 w-20 rounded border ${
                            viewImageIndex === idx ? "ring-2 ring-primary" : "border-muted"
                          } overflow-hidden`}
                          onClick={() => setViewImageIndex(idx)}
                        >
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{viewInventoryItem.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {viewInventoryItem.description || "No description provided."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="text-lg font-semibold">{formatPrice(viewInventoryItem)}</p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">Stock</p>
                      <p className="text-lg font-semibold">{viewInventoryItem.stock - 0}</p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="text-sm font-medium">{viewInventoryItem.category || "â€”"}</p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant={viewInventoryItem.isActive ? "default" : "secondary"}>
                        {viewInventoryItem.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-muted-foreground mb-1">ID</p>
                    <p className="text-sm font-mono break-all">
                      {viewInventoryItem._id || viewInventoryItem.id || "â€”"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stores Management</CardTitle>
            <Button
              onClick={() => {
                // prepare new store form
                setSelectedStore(null);
                setFormData({ name: "", description: "", location: "", phone: "", email: "" });
                setSelectedOwnerId("");
                setSelectedCompanyId(storeCompanyId ? String(storeCompanyId) : "");
                setSelectedStoreAssignment(storeTab === "estate" && selectedEstateFilter ? selectedEstateFilter : "global");
                setIsCreateDialogOpen(true);
              }}
              data-testid="button-create-store"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Store
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" variant={storeTab === "global" ? "default" : "outline"} onClick={() => setStoreTab("global")}>Global Stores</Button>
            <div className="flex items-center">
              <Button size="sm" variant={storeTab === "estate" ? "default" : "outline"} onClick={() => setStoreTab("estate")}>Estate Stores</Button>
              {storeTab === "estate" && (
                <div className="ml-3">
                  <Select value={selectedEstateFilter || "all"} onValueChange={(v) => setSelectedEstateFilter(v === "all" ? null : v)}>
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue placeholder="Select estate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Estates</SelectItem>
                      {Array.isArray(estatesForFilter) && estatesForFilter.map((e: any) => (
                        <SelectItem key={e.id || e._id} value={e.id || e._id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search stores..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-stores"
              />
            </div>
          </div>

          {/* Stores Table */}
                {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Loading stores...</p>
            </div>
          ) : !filteredStores || filteredStores.length === 0 ? (
            <div className="text-center py-8">
              <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                No stores found for the selected view. Create your first store to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Store Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStores.map((store: any) => {
                    const storeId = String(store._id || store.id);
                    const approvalStatus = String(store.approvalStatus || "pending").toLowerCase();
                    const isApproved = approvalStatus === "approved";
                    const ownerMatch = Array.isArray(scopedStoreProviders)
                      ? scopedStoreProviders.find((p: any) => String(p.id || p._id) === String(store.ownerId || store.owner_id))
                      : null;
                    const ownerLabel = ownerMatch?.name || ownerMatch?.email || store.ownerId || store.owner_id || "Unassigned";
                    return (
                    <tr key={storeId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Store className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {store.name}
                            </div>
                            {store.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {store.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400">
                              Owner: {ownerLabel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {store.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div>{store.phone || "â€”"}</div>
                        <div>{store.email || "â€”"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <Badge
                            variant={isApproved ? "default" : "secondary"}
                            data-testid={`badge-store-status-${storeId}`}
                          >
                            {isApproved ? "Approved" : approvalStatus === "rejected" ? "Rejected" : "Pending"}
                          </Badge>
                          <Badge variant={store.isActive ? "default" : "secondary"}>
                            {store.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2 flex items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToStoreMembers(String(store._id || store.id))}
                          data-testid={`button-view-store-${store._id || store.id}`}
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Members
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // placeholder hook for view store details
                            setSelectedStore(store);
                            toast({ title: "View store", description: store.name });
                          }}
                          data-testid={`button-view-store-details-${store._id || store.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedStore(store);
                            setIsCreateDialogOpen(true);
                            // prefill form for edit
                            setFormData({
                              name: store.name || "",
                              description: store.description || "",
                              location: store.location || "",
                              phone: store.phone || "",
                              email: store.email || "",
                            });
                            setSelectedOwnerId(store.ownerId || store.owner_id || "");
                            setSelectedCompanyId(String(store.companyId || store.company_id || ""));
                            setSelectedStoreAssignment(
                              (store.estateId || store.estate_id) ? (store.estateId || store.estate_id) : "global"
                            );
                          }}
                          data-testid={`button-edit-store-${store._id || store.id}`}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant={isApproved ? "outline" : "default"}
                          size="sm"
                          onClick={() =>
                            createStoreMutation.mutate({
                              id: storeId,
                              payload: { isApproved: true },
                            })
                          }
                          disabled={isApproved}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            createStoreMutation.mutate({
                              id: storeId,
                              payload: { isApproved: false },
                            })
                          }
                          disabled={approvalStatus === "rejected"}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            (companyIdOverride
                              ? setLocation(
                                  `/admin-dashboard/companies/stores/${encodeURIComponent(String(companyIdOverride))}/inventory/${store._id || store.id}`,
                                )
                              : setLocation(withCompanyQuery(`/admin-dashboard/stores/inventory/${store._id || store.id}`)))
                          }
                          data-testid={`button-add-inventory-${store._id || store.id}`}
                        >
                          <Package className="w-4 h-4 mr-1" />
                          Add Inventory
                        </Button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Store Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[60vw] max-w-[60vw]">
          <DialogHeader>
            <DialogTitle>{selectedStore ? "Edit Store" : "Create New Store"}</DialogTitle>
            <DialogDescription className="sr-only">
              {selectedStore ? "Update store details" : "Add a new store to the platform"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Full Width: Company */}
            <div>
              <Label htmlFor="store-company">Company *</Label>
              {storeCompanyId ? (
                <Input
                  id="store-company"
                  value={storeCompany?.name || String(storeCompanyId)}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                  data-testid="input-store-company-readonly"
                />
              ) : (
                <Select
                  value={selectedCompanyId}
                  onValueChange={(v) => {
                    setSelectedCompanyId(v);
                    // clear dependent selections when company changes
                    setSelectedOwnerId("");
                    setFormData((prev) => ({ ...prev, phone: "", email: "" }));
                  }}
                >
                  <SelectTrigger id="store-company" data-testid="select-store-company">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(companies) && companies.length > 0 ? (
                      companies.map((c: any) => {
                        const cid = String(c.id || c._id);
                        return (
                          <SelectItem key={cid} value={cid}>
                            {c.name || cid}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>
                        No companies found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* First Row: Store Name and Location */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store-name">Store Name *</Label>
                <Input
                  id="store-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter store name"
                  data-testid="input-store-name"
                />
              </div>
              <div>
                <Label htmlFor="store-location">Location *</Label>
                <Input
                  id="store-location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="Enter store location"
                  data-testid="input-store-location"
                />
              </div>
            </div>

            {/* Full Width: Description */}
            <div>
              <Label htmlFor="store-description">Description</Label>
              <Textarea
                id="store-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Brief description of the store"
                rows={3}
                data-testid="textarea-store-description"
              />
            </div>

            {/* Full Width: Store Owner */}
            <div>
              <Label htmlFor="store-owner">Store Owner</Label>
              <Select
                value={selectedOwnerId}
                onValueChange={setSelectedOwnerId}
              >
                <SelectTrigger id="store-owner" data-testid="select-store-owner">
                  <SelectValue placeholder="Select store owner" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const eligible = Array.isArray(scopedStoreProviders)
                      ? scopedStoreProviders
                      : [];
                    return eligible.length > 0 ? (
                      eligible.map((p: any) => {
                        const pid = p.id || p._id;
                        return (
                          <SelectItem key={pid} value={pid}>
                            {p.name || p.email}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>
                        No providers available
                      </SelectItem>
                    );
                  })()}
                </SelectContent>
              </Select>
            </div>

            {/* Second Row: Phone and Email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store-phone">Phone</Label>
                <Input
                  id="store-phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                  placeholder="+234..."
                  data-testid="input-store-phone"
                />
              </div>
              <div>
                <Label htmlFor="store-email">Email</Label>
                <Input
                  id="store-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                  placeholder="store@example.com"
                  data-testid="input-store-email"
                />
              </div>
            </div>

            {/* Full Width: Assign To */}
            <div>
              <Label htmlFor="store-assignment">Assign To</Label>
              <Select
                value={selectedStoreAssignment || "global"}
                onValueChange={(v) => setSelectedStoreAssignment(v)}
              >
                <SelectTrigger id="store-assignment">
                  <SelectValue placeholder="Assign store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (no estate)</SelectItem>
                  {Array.isArray(estatesForFilter) && estatesForFilter.map((e: any) => (
                    <SelectItem key={e.id || e._id} value={e.id || e._id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              data-testid="button-cancel-create-store"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createStoreMutation.isPending}
              data-testid="button-submit-create-store"
            >
              {createStoreMutation.isPending
                ? selectedStore
                  ? "Saving..."
                  : "Creating..."
                : selectedStore
                  ? "Save Store"
                  : "Create Store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
};

// Item Categories page (standalone)
const ItemCategoriesPage = () => {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const categoryForm = useForm({
    defaultValues: { name: "", description: "", emoji: "", isActive: true },
  });

  const { data: itemCategories = [], refetch } = useQuery({
    queryKey: ["/api/admin/item-categories"],
    queryFn: () => adminApiRequest("GET", "/api/admin/item-categories"),
  });

  const upsertCategoryMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing?.id) {
        return adminApiRequest("PATCH", `/api/admin/item-categories/${editing.id}`, payload);
      }
      return adminApiRequest("POST", "/api/admin/item-categories", payload);
    },
    onSuccess: () => {
      refetch();
      categoryForm.reset();
      setEditing(null);
      setShowModal(false);
      toast({ title: editing ? "Category updated" : "Category created" });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving category",
        description: error?.message || "Failed to save category",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => adminApiRequest("DELETE", `/api/admin/item-categories/${id}`),
    onSuccess: () => {
      refetch();
      toast({ title: "Category deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting category",
        description: error?.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-0">
          <div className="relative w-full">
            <img
              src="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80"
              alt="Service categories illustration"
              className="w-full h-44 sm:h-56 object-cover rounded-lg shadow-sm"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent rounded-lg"></div>

            <div className="absolute inset-0 flex items-center justify-between px-6">
              <div className="text-white">
                <CardTitle className="text-white">Item Categories</CardTitle>
                <CardDescription className="text-white/90">Manage marketplace item categories.</CardDescription>
              </div>
              <div>
                <Button
                  onClick={() => {
                    setEditing(null);
                    categoryForm.reset({ name: "", description: "", emoji: "", isActive: true });
                    setShowModal(true);
                  }}
                >
                  + New Category
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(itemCategories) && itemCategories.length > 0 ? (
                itemCategories.map((cat: any) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {cat.emoji ? <span className="text-lg leading-none">{cat.emoji}</span> : null}
                        <span>{cat.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.description || "No description"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cat.isActive ? "default" : "secondary"}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(cat);
                          categoryForm.reset({
                            name: cat.name || "",
                            description: cat.description || "",
                            emoji: cat.emoji || "",
                            isActive: cat.isActive ?? true,
                          });
                          setShowModal(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteCategoryMutation.mutate(cat.id)}
                        disabled={deleteCategoryMutation.isPending}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No categories yet. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="w-[60vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Create Category"}</DialogTitle>
            <DialogDescription>
              Define item categories that can be used when adding inventory items.
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form
              className="space-y-4"
              onSubmit={categoryForm.handleSubmit((values) => {
                if (!values.name || !String(values.name).trim()) {
                  toast({ title: "Name is required", variant: "destructive" });
                  return;
                }
                upsertCategoryMutation.mutate(values);
              })}
            >
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Groceries" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="emoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emoji Icon</FormLabel>
                    <EmojiCombobox
                      value={field.value}
                      onChange={(v) => field.onChange(v)}
                      placeholder="Type to search or pick an emoji"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Short description (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        className="h-6 w-6"
                        indicatorClassName="h-5 w-5"
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(Boolean(v))}
                      />
                    </FormControl>
                    <FormLabel className="mb-0">Active</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertCategoryMutation.isPending}>
                  {upsertCategoryMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Category"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

