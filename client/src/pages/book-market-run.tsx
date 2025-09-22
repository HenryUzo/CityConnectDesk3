import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingBag, LogOut, Search, Filter, Star, Clock, MapPin, ShoppingCart, Plus, Minus } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";

// Marketplace data types
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface Vendor {
  id: string;
  name: string;
  type: 'local_food' | 'grocery';
  rating: number;
  deliveryTime: string;
  location: string;
  description: string;
  items: VendorItem[];
}

interface VendorItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  description?: string;
  image?: string;
}

// Mock data
const mockVendors: Vendor[] = [
  {
    id: '1',
    name: 'Mama Ngozi Kitchen',
    type: 'local_food',
    rating: 4.8,
    deliveryTime: '20-30 mins',
    location: 'Block A Market',
    description: 'Authentic Nigerian dishes made fresh daily',
    items: [
      { id: '1', name: 'Jollof Rice + Chicken', price: 1500, available: true, description: 'Spicy jollof rice with grilled chicken' },
      { id: '2', name: 'Fried Rice + Fish', price: 1800, available: true, description: 'Fried rice with fresh fish' },
      { id: '3', name: 'Pounded Yam + Egusi', price: 2000, available: true, description: 'Fresh pounded yam with egusi soup' },
      { id: '4', name: 'Amala + Ewedu', price: 1200, available: false, description: 'Amala with ewedu and stew' },
    ]
  },
  {
    id: '2',
    name: 'Sweet Bites Cafeteria',
    type: 'local_food',
    rating: 4.5,
    deliveryTime: '15-25 mins',
    location: 'Food Court Plaza',
    description: 'Quick meals and snacks for busy schedules',
    items: [
      { id: '5', name: 'Meat Pie', price: 400, available: true, description: 'Freshly baked meat pie' },
      { id: '6', name: 'Chicken Shawarma', price: 800, available: true, description: 'Grilled chicken shawarma wrap' },
      { id: '7', name: 'Fried Plantain + Beans', price: 600, available: true, description: 'Sweet plantain with beans sauce' },
      { id: '8', name: 'Suya (Large)', price: 1000, available: true, description: 'Spiced grilled beef suya' },
    ]
  },
  {
    id: '3',
    name: 'FreshMart Grocery',
    type: 'grocery',
    rating: 4.6,
    deliveryTime: '45-60 mins',
    location: 'Main Shopping Complex',
    description: 'Wide variety of fresh groceries and household items',
    items: [
      { id: '9', name: 'Rice (5kg bag)', price: 3500, available: true, description: 'Premium long grain rice' },
      { id: '10', name: 'Tomatoes (1kg)', price: 800, available: true, description: 'Fresh ripe tomatoes' },
      { id: '11', name: 'Onions (1kg)', price: 600, available: true, description: 'Fresh red onions' },
      { id: '12', name: 'Cooking Oil (1L)', price: 1200, available: false, description: 'Vegetable cooking oil' },
      { id: '13', name: 'Bread (Large)', price: 500, available: true, description: 'Fresh baked bread loaf' },
      { id: '14', name: 'Eggs (1 crate)', price: 2800, available: true, description: 'Fresh chicken eggs' },
    ]
  },
  {
    id: '4',
    name: 'QuickStop Essentials',
    type: 'grocery',
    rating: 4.2,
    deliveryTime: '30-45 mins',
    location: 'Corner Shop Street',
    description: 'Convenient store with everyday essentials',
    items: [
      { id: '15', name: 'Milk (1L)', price: 600, available: true, description: 'Fresh dairy milk' },
      { id: '16', name: 'Sugar (1kg)', price: 700, available: true, description: 'Granulated white sugar' },
      { id: '17', name: 'Salt (500g)', price: 200, available: true, description: 'Table salt' },
      { id: '18', name: 'Detergent (500g)', price: 450, available: true, description: 'Washing powder' },
    ]
  }
];

export default function BookMarketRun() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Marketplace state
  const [activeTab, setActiveTab] = useState('local_food');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  
  // Filter vendors by type and search
  const filteredVendors = mockVendors.filter(vendor => {
    const typeMatch = vendor.type === activeTab;
    const searchMatch = searchQuery === '' || vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       vendor.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const locationMatch = selectedLocation === 'all' || vendor.location.toLowerCase().includes(selectedLocation.toLowerCase());
    return typeMatch && searchMatch && locationMatch;
  });
  
  // Cart functions
  const addToCart = (item: VendorItem, vendorName: string) => {
    if (!item.available) return;
    
    // Create unique cart item ID to prevent vendor collisions
    const cartItemId = `${vendorName.replace(/\s+/g, '_').toLowerCase()}_${item.id}`;
    const existingItem = cart.find((cartItem: CartItem) => cartItem.id === cartItemId);
    if (existingItem) {
      setCart(cart.map((cartItem: CartItem) => 
        cartItem.id === cartItemId 
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { 
        id: cartItemId, 
        name: `${item.name} (${vendorName})`, 
        price: item.price, 
        quantity: 1 
      }]);
    }
    
    toast({
      title: "Added to cart",
      description: `${item.name} has been added to your cart`,
    });
  };
  
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item: CartItem) => item.id !== itemId));
  };
  
  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(cart.map((item: CartItem) => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };
  
  const getTotalPrice = (): number => {
    return cart.reduce((total: number, item: CartItem) => total + (item.price * item.quantity), 0);
  };

  const submitOrderMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) {
        throw new Error('Cart is empty');
      }
      
      const orderData = {
        description: `Marketplace order: ${cart.map(item => `${item.quantity}x ${item.name}`).join(', ')}`,
        urgency: 'medium',
        budget: `₦${getTotalPrice().toLocaleString()}`,
        location: 'Delivery address to be confirmed',
        category: "market_runner",
        cartItems: cart,
        totalAmount: getTotalPrice()
      };
      
      return await apiRequest("POST", "/api/service-requests", orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({
        title: "Order Placed",
        description: "Your order has been submitted successfully!",
      });
      setCart([]);
      setLocation("/resident");
    },
    onError: (error: Error) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/");
  };
  
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to your cart before checking out",
        variant: "destructive",
      });
      return;
    }
    submitOrderMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">CityConnect</h1>
              <span className="ml-2 sm:ml-3 text-xs sm:text-sm text-muted-foreground truncate">Market Run</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 w-9 p-0" data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/resident")} 
            className="mb-4 h-11 min-h-[44px] px-4"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-3 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0">
              <ShoppingBag className="w-8 h-8 text-secondary mr-0 sm:mr-3" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Marketplace</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Order food and groceries from local vendors</p>
              </div>
            </div>
            
            {/* Cart Summary */}
            {cart.length > 0 && (
              <Card className="w-full sm:w-auto mt-4 sm:mt-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{cart.length} items</p>
                        <p className="text-xs text-muted-foreground">₦{getTotalPrice().toLocaleString()}</p>
                      </div>
                    </div>
                    <Button 
                      onClick={handleCheckout}
                      disabled={submitOrderMutation.isPending}
                      className="h-9"
                      data-testid="button-checkout"
                    >
                      {submitOrderMutation.isPending ? "Processing..." : "Checkout"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="local_food" className="text-base" data-testid="tab-local-food">
              Local Food Runs
            </TabsTrigger>
            <TabsTrigger value="grocery" className="text-base" data-testid="tab-grocery">
              Groceries
            </TabsTrigger>
          </TabsList>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={activeTab === 'local_food' ? "Search food items or restaurants..." : "Search groceries or stores..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12"
                    data-testid="input-search"
                  />
                </div>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-full sm:w-48 h-12" data-testid="select-location-filter">
                    <SelectValue placeholder="Filter by location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    <SelectItem value="block a">Block A Market</SelectItem>
                    <SelectItem value="food court">Food Court Plaza</SelectItem>
                    <SelectItem value="main shopping">Main Shopping Complex</SelectItem>
                    <SelectItem value="corner shop">Corner Shop Street</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <TabsContent value="local_food" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredVendors.length > 0 ? (
                filteredVendors.map((vendor) => (
                  <Card key={vendor.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{vendor.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{vendor.rating}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span className="text-sm">{vendor.deliveryTime}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground mt-1">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm">{vendor.location}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{vendor.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {vendor.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{item.name}</p>
                              {!item.available && (
                                <Badge variant="destructive" className="text-xs">Out of stock</Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                            )}
                            <p className="text-sm font-bold text-primary mt-1">₦{item.price.toLocaleString()}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addToCart(item, vendor.name)}
                            disabled={!item.available}
                            className="ml-3"
                            data-testid={`button-add-${item.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No food vendors found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or location filter</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="grocery" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredVendors.length > 0 ? (
                filteredVendors.map((vendor) => (
                  <Card key={vendor.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{vendor.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{vendor.rating}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span className="text-sm">{vendor.deliveryTime}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground mt-1">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm">{vendor.location}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{vendor.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {vendor.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{item.name}</p>
                              {!item.available && (
                                <Badge variant="destructive" className="text-xs">Out of stock</Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                            )}
                            <p className="text-sm font-bold text-primary mt-1">₦{item.price.toLocaleString()}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addToCart(item, vendor.name)}
                            disabled={!item.available}
                            className="ml-3"
                            data-testid={`button-add-${item.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No grocery stores found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or location filter</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Cart Summary */}
        {cart.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Your Cart ({cart.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.map((item: CartItem) => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-sm text-muted-foreground">₦{item.price.toLocaleString()} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="h-8 w-8 p-0"
                        data-testid={`button-decrease-${item.id}`}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-8 w-8 p-0"
                        data-testid={`button-increase-${item.id}`}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="font-bold text-primary min-w-[80px] text-right">
                      ₦{(item.price * item.quantity).toLocaleString()}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFromCart(item.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-remove-${item.id}`}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">₦{getTotalPrice().toLocaleString()}</span>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setCart([])} 
                    className="flex-1"
                    data-testid="button-clear-cart"
                  >
                    Clear Cart
                  </Button>
                  <Button 
                    onClick={handleCheckout}
                    disabled={submitOrderMutation.isPending}
                    className="flex-1"
                    data-testid="button-checkout-final"
                  >
                    {submitOrderMutation.isPending ? "Processing..." : "Place Order"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
