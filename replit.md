# Overview

CityConnect is a full-stack MVP web application that connects estate residents with service providers for artisan repairs and market runs/errands. The platform enables residents to request services while allowing providers (artisans and market runners) to accept and fulfill these requests. The application includes role-based access for residents, service providers, and administrators with comprehensive request tracking and management features.

The system uses a dual-database architecture: MongoDB for the admin management system and PostgreSQL for the resident/provider operations, connected via secure bridge APIs with proper multi-tenant isolation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Single-page application using React 18 with TypeScript for type safety
- **Vite Build System**: Fast development server and optimized production builds
- **Wouter Routing**: Lightweight client-side routing for navigation between pages
- **ShadCN UI Components**: Comprehensive component library built on Radix UI primitives
- **TailwindCSS**: Utility-first CSS framework for responsive, mobile-first design
- **React Hook Form + Zod**: Form management with schema validation
- **TanStack React Query**: Server state management, caching, and API synchronization

## Backend Architecture
- **Express.js Server**: RESTful API server with middleware for request logging and error handling
- **Passport.js Authentication**: Local strategy authentication with session management
- **Role-Based Access Control**: Three user roles (resident, provider, admin) with appropriate permissions
- **Custom Password Hashing**: Crypto module with scrypt for secure password storage
- **Session Storage**: PostgreSQL-backed session store for persistent authentication

## Database Design
- **PostgreSQL with Drizzle ORM**: Type-safe database operations with schema migrations
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Relational Schema**: Users, service requests, wallets, and transactions tables with proper foreign key relationships
- **Enum Types**: Strongly typed status fields for service categories, urgency levels, and request statuses

## Key Features Implementation
- **Service Categories**: Electrician, plumber, carpenter, and market runner services
- **Request Lifecycle**: Pending → Assigned → In Progress → Completed workflow
- **Real-time Updates**: Query invalidation for immediate UI updates after mutations
- **Access Code Login**: 6-digit code alternative for resident authentication
- **Admin Dashboard**: User management, provider approval, and system statistics
- **Multi-Tenant Management**: Global/Estate toggle for super admins to view all users and providers across estates or filter by specific estate
  - **User Management**: Purple theme for global view, teal theme for estate view
  - **Provider Management**: Same Global/Estate toggle pattern with purple/teal theming
  - **Company Categorization**: Providers can be categorized by company or marked as independent
  - **Company Filtering**: Filter providers by specific companies or independent status
- **Bridge Integration**: Secure connection between MongoDB admin system and PostgreSQL resident/provider data
- **Mobile-Responsive Design**: Optimized layouts for mobile devices

## API Structure
- **Authentication Endpoints**: Login, logout, and registration with role-specific flows
- **Service Request CRUD**: Create, read, update requests with status management
- **Provider Acceptance**: Endpoint for providers to accept available requests
- **Admin Functions**: User approval, statistics, and system management
- **Bridge Endpoints**: Secure APIs connecting MongoDB admin system with PostgreSQL data
  - `/api/admin/bridge/users` - Fetch users (including providers with role=provider) with estate scoping
  - `/api/admin/bridge/service-requests` - Fetch service requests with tenant filtering
  - `/api/admin/bridge/stats` - Get aggregated statistics for current estate or globally
  - `/api/admin/bridge/providers/:id/approval` - Approve/reject providers from PostgreSQL
  - `/api/admin/bridge/users/:id/wallet` - View user wallet details
- **Protected Routes**: Authentication middleware with estate context for secure multi-tenant access
- **Provider Management**: Uses bridge API to display all providers from PostgreSQL operational database

# External Dependencies

## Database & Storage
- **Neon Database**: Serverless PostgreSQL database hosting
- **Drizzle ORM**: TypeScript-first ORM for database operations
- **Connect-PG-Simple**: PostgreSQL session store for Express sessions

## Authentication & Security
- **Passport.js**: Authentication middleware with local strategy
- **BCryptjs**: Password hashing and verification
- **Express-Session**: Session management for authentication state

## Frontend Libraries
- **React Query**: Server state management and caching
- **React Hook Form**: Form state management and validation
- **Zod**: Schema validation for forms and API data
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library for UI components
- **Date-fns**: Date manipulation and formatting

## Development Tools
- **Vite**: Development server and build tool
- **TypeScript**: Static type checking
- **TailwindCSS**: Utility-first CSS framework
- **ESBuild**: Fast JavaScript bundling for production