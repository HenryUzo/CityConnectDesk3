# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:runtime-error-plugin] useAdminAuth must be used within AdminAuthProvider"
  - generic [ref=e5]: C:/Users/Admin/OneDrive/Documents/CityConnectDesk new/CityConnectDesk/client/src/pages/admin-super-dashboard.tsx:290:11
  - generic [ref=e6]: "288| const context = useContext(AdminAuthContext); 289| if (!context) { 290| throw new Error(\"useAdminAuth must be used within AdminAuthProvider\"); | ^ 291| } 292| return context;"
  - generic [ref=e7]: at useAdminAuth C:/Users/Admin/OneDrive/Documents/CityConnectDesk new/CityConnectDesk/client/src/pages/admin-super-dashboard.tsx:290:11 at AdminSuperDashboard C:/Users/Admin/OneDrive/Documents/CityConnectDesk new/CityConnectDesk/client/src/pages/admin-super-dashboard.tsx:4657:61
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.js
    - text: .
```