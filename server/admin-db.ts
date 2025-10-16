import mongoose from 'mongoose';
import {
  EstateSchema,
  UserSchema,
  MembershipSchema,
  ProviderSchema,
  ServiceRequestSchema,
  MarketplaceItemSchema,
  OrderSchema,
  CategorySchema,
  AuditLogSchema,
  StoreSchema,
  StoreMemberSchema,
  type IEstate,
  type IUser,
  type IMembership,
  type IProvider,
  type IServiceRequest,
  type IMarketplaceItem,
  type IOrder,
  type ICategory,
  type IAuditLog,
  type IStore,
  type IStoreMember
} from '../shared/admin-schema';

// MongoDB Models
export const Estate = mongoose.model<IEstate>('Estate', EstateSchema);
export const AdminUser = mongoose.model<IUser>('AdminUser', UserSchema);
export const Membership = mongoose.model<IMembership>('Membership', MembershipSchema);
export const AdminProvider = mongoose.model<IProvider>('AdminProvider', ProviderSchema);
export const AdminServiceRequest = mongoose.model<IServiceRequest>('AdminServiceRequest', ServiceRequestSchema);
export const MarketplaceItem = mongoose.model<IMarketplaceItem>('MarketplaceItem', MarketplaceItemSchema);
export const Order = mongoose.model<IOrder>('Order', OrderSchema);
export const AdminCategory = mongoose.model<ICategory>('AdminCategory', CategorySchema);
export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export const Store = mongoose.model<IStore>('Store', StoreSchema);
export const StoreMember = mongoose.model<IStoreMember>('StoreMember', StoreMemberSchema);

class AdminDatabase {
  private _isConnected = false;

  get isConnected() {
    return this._isConnected;
  }

  // Expose models as properties
  Estate = Estate;
  AdminUser = AdminUser;
  Membership = Membership;
  AdminProvider = AdminProvider;
  AdminServiceRequest = AdminServiceRequest;
  MarketplaceItem = MarketplaceItem;
  Order = Order;
  AdminCategory = AdminCategory;
  AuditLog = AuditLog;
  Store = Store;
  StoreMember = StoreMember;

  async connect() {
    if (this._isConnected) return;

    try {
      const mongoUri = process.env.MONGODB_URI;
      
      if (!mongoUri) {
        console.log('No MONGODB_URI provided, admin database will be unavailable');
        return;
      }
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this._isConnected = true;
      console.log('Admin MongoDB connected successfully');
    } catch (error: any) {
      console.warn('Admin MongoDB connection failed, admin features will be unavailable:', error.message);
      // Don't throw - allow the app to continue without admin DB
    }
  }

  async disconnect() {
    if (!this._isConnected) return;
    
    await mongoose.disconnect();
    this._isConnected = false;
    console.log('Admin MongoDB disconnected');
  }

  // Estate Operations
  async createEstate(data: any) {
    const estate = new Estate(data);
    return await estate.save();
  }

  async getEstates(filter: any = {}) {
    return await Estate.find({ isActive: true, ...filter }).sort({ createdAt: -1 });
  }

  async getEstateById(id: string) {
    return await Estate.findById(id);
  }

  async getEstateBySlug(slug: string) {
    return await Estate.findOne({ slug, isActive: true });
  }

  async updateEstate(id: string, data: any) {
    return await Estate.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteEstate(id: string) {
    return await Estate.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }

  // User Operations
  async createUser(data: any) {
    const user = new AdminUser(data);
    return await user.save();
  }

  async getUserByEmail(email: string) {
    return await AdminUser.findOne({ email, isActive: true });
  }

  async getUserById(id: string) {
    return await AdminUser.findById(id);
  }

  async getUsers(filter: any = {}) {
    return await AdminUser.find({ isActive: true, ...filter }).sort({ createdAt: -1 });
  }

  async updateUser(id: string, data: any) {
    return await AdminUser.findByIdAndUpdate(id, data, { new: true });
  }

  // Membership Operations
  async createMembership(data: any) {
    const membership = new Membership(data);
    return await membership.save();
  }

  async getUserMemberships(userId: string) {
    return await Membership.find({ userId, isActive: true });
  }

  async getEstateMemberships(estateId: string, role?: string) {
    const filter: any = { estateId, isActive: true };
    if (role) filter.role = role;
    return await Membership.find(filter);
  }

  async updateMembership(userId: string, estateId: string, data: any) {
    return await Membership.findOneAndUpdate(
      { userId, estateId },
      data,
      { new: true, upsert: true }
    );
  }

  // Service Request Operations
  async createServiceRequest(data: any) {
    const request = new AdminServiceRequest(data);
    return await request.save();
  }

  async getServiceRequests(filter: any = {}) {
    return await AdminServiceRequest.find(filter).sort({ createdAt: -1 });
  }

  async getServiceRequestsByEstate(estateId: string, filter: any = {}) {
    return await AdminServiceRequest.find({ estateId, ...filter }).sort({ createdAt: -1 });
  }

  async updateServiceRequest(id: string, data: any) {
    return await AdminServiceRequest.findByIdAndUpdate(id, data, { new: true });
  }

  // Provider Operations
  async createProvider(data: any) {
    const provider = new AdminProvider(data);
    return await provider.save();
  }

  async getProviders(filter: any = {}) {
    return await AdminProvider.find(filter);
  }

  async getProvidersByEstate(estateId: string) {
    return await AdminProvider.find({ estates: estateId });
  }

  async updateProvider(id: string, data: any) {
    return await AdminProvider.findByIdAndUpdate(id, data, { new: true });
  }

  // Marketplace Operations
  async createMarketplaceItem(data: any) {
    const item = new MarketplaceItem(data);
    return await item.save();
  }

  async getMarketplaceItems(filter: any = {}) {
    return await MarketplaceItem.find({ isActive: true, ...filter }).sort({ createdAt: -1 });
  }

  async getMarketplaceItemsByEstate(estateId: string, filter: any = {}) {
    return await MarketplaceItem.find({ estateId, isActive: true, ...filter }).sort({ createdAt: -1 });
  }

  async updateMarketplaceItem(id: string, data: any) {
    return await MarketplaceItem.findByIdAndUpdate(id, data, { new: true });
  }

  // Order Operations
  async createOrder(data: any) {
    const order = new Order(data);
    return await order.save();
  }

  async getOrders(filter: any = {}) {
    return await Order.find(filter).sort({ createdAt: -1 });
  }

  async getOrdersByEstate(estateId: string, filter: any = {}) {
    return await Order.find({ estateId, ...filter }).sort({ createdAt: -1 });
  }

  async updateOrder(id: string, data: any) {
    return await Order.findByIdAndUpdate(id, data, { new: true });
  }

  // Store Operations
  async createStore(data: any) {
    const store = new Store(data);
    return await store.save();
  }

  async getStores(filter: any = {}) {
    return await Store.find({ isActive: true, ...filter }).sort({ createdAt: -1 });
  }

  async getStoresByEstate(estateId: string, filter: any = {}) {
    return await Store.find({ estateId, isActive: true, ...filter }).sort({ createdAt: -1 });
  }

  async updateStore(id: string, data: any) {
    return await Store.findByIdAndUpdate(id, data, { new: true });
  }

  // Store Member Operations
  async createStoreMember(data: any) {
    const storeMember = new StoreMember(data);
    return await storeMember.save();
  }

  async getStoreMembers(storeId: string, filter: any = {}) {
    return await StoreMember.find({ storeId, isActive: true, ...filter }).sort({ createdAt: -1 });
  }

  async updateStoreMember(id: string, data: any) {
    return await StoreMember.findByIdAndUpdate(id, data, { new: true });
  }

  // Category Operations
  async createCategory(data: any) {
    const category = new AdminCategory(data);
    return await category.save();
  }

  async getCategories(filter: any = {}) {
    return await AdminCategory.find({ isActive: true, ...filter }).sort({ name: 1 });
  }

  async getCategoriesByScope(scope: 'global' | 'estate', estateId?: string) {
    const filter: any = { scope, isActive: true };
    if (scope === 'estate' && estateId) {
      filter.estateId = estateId;
    }
    return await AdminCategory.find(filter).sort({ name: 1 });
  }

  async updateCategory(id: string, data: any) {
    return await AdminCategory.findByIdAndUpdate(id, data, { new: true });
  }

  // Audit Log Operations
  async createAuditLog(data: any) {
    const log = new AuditLog(data);
    return await log.save();
  }

  async getAuditLogs(filter: any = {}, limit: number = 100) {
    return await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit);
  }

  async getAuditLogsByEstate(estateId: string, limit: number = 100) {
    return await AuditLog.find({ estateId }).sort({ createdAt: -1 }).limit(limit);
  }

  // Analytics Operations
  async getEstateStats(estateId: string) {
    const [
      totalUsers,
      totalProviders,
      totalRequests,
      activeRequests,
      totalOrders,
      pendingOrders,
      totalRevenue
    ] = await Promise.all([
      Membership.countDocuments({ estateId, isActive: true }),
      AdminProvider.countDocuments({ estates: estateId }),
      AdminServiceRequest.countDocuments({ estateId }),
      AdminServiceRequest.countDocuments({ estateId, status: { $in: ['pending', 'assigned', 'in_progress'] } }),
      Order.countDocuments({ estateId }),
      Order.countDocuments({ estateId, status: 'pending' }),
      Order.aggregate([
        { $match: { estateId, status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
    ]);

    return {
      totalUsers,
      totalProviders,
      totalRequests,
      activeRequests,
      totalOrders,
      pendingOrders,
      totalRevenue: totalRevenue[0]?.total || 0
    };
  }

  async getGlobalStats() {
    const [
      totalEstates,
      totalUsers,
      totalProviders,
      totalRequests,
      totalOrders,
      totalRevenue
    ] = await Promise.all([
      Estate.countDocuments({ isActive: true }),
      AdminUser.countDocuments({ isActive: true }),
      AdminProvider.countDocuments(),
      AdminServiceRequest.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
    ]);

    return {
      totalEstates,
      totalUsers,
      totalProviders,
      totalRequests,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0
    };
  }
}

// Singleton instance
export const adminDb = new AdminDatabase();

// Auto-connect when module is imported
if (process.env.NODE_ENV !== 'test') {
  adminDb.connect().catch(console.error);
}