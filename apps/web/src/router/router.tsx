import { lazy, Suspense } from 'react';
import { PageLoader } from '@/components/common/PageLoader';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteError } from '@/components/common/RouteError';
import { RootShell } from './RootShell';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { FIRST_PASSWORD_PATH, ProtectedRoute, RedirectIfAuthed } from './ProtectedRoute';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RoleGuard } from './RoleGuard';
import { PublicCustomerRoute } from './PublicCustomerRoute';
import { env } from '@/lib/env';
import type { ReactNode } from 'react';
import type { Role } from '@/types/common';
import { RoleSelectPage } from '@/pages/RoleSelectPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { OtpPage } from '@/pages/auth/OtpPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CustomerProfilePage } from '@/pages/customer/CustomerProfilePage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { TermsPage } from '@/pages/legal/TermsPage';
import { SuspendedBanner } from '@/features/shop/components/SuspendedBanner';
import { LegacyInstallationRedirect, PanelRoot } from './redirects';

const AdminHome = lazy(() => import('@/pages/admin/AdminHome').then((m) => ({ default: m.AdminHome })));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminAdminsPage = lazy(() => import('@/pages/admin/AdminAdminsPage').then((m) => ({ default: m.AdminAdminsPage })));
const AdminUserProfilePage = lazy(() => import('@/pages/admin/AdminUserProfilePage').then((m) => ({ default: m.AdminUserProfilePage })));
const AdminPoliciesPage = lazy(() => import('@/pages/admin/AdminPoliciesPage').then((m) => ({ default: m.AdminPoliciesPage })));
const AdminAuditPage = lazy(() => import('@/pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminProfilePage = lazy(() => import('@/pages/admin/AdminProfilePage').then((m) => ({ default: m.AdminProfilePage })));
const AdminErrorsPage = lazy(() => import('@/pages/admin/AdminErrorsPage').then((m) => ({ default: m.AdminErrorsPage })));
const AdminDevOpsPage = lazy(() => import('@/pages/admin/AdminDevOpsPage').then((m) => ({ default: m.AdminDevOpsPage })));

const CatalogPage = lazy(() => import('@/pages/catalog/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const ProductPage = lazy(() => import('@/pages/catalog/ProductPage').then((m) => ({ default: m.ProductPage })));
const ComparePage = lazy(() => import('@/pages/catalog/ComparePage').then((m) => ({ default: m.ComparePage })));
const ShopsPage = lazy(() => import('@/pages/catalog/ShopsPage').then((m) => ({ default: m.ShopsPage })));
const ShopProfilePage = lazy(() => import('@/pages/catalog/ShopProfilePage').then((m) => ({ default: m.ShopProfilePage })));
const QuickCalcPage = lazy(() => import('@/pages/calc/QuickCalcPage').then((m) => ({ default: m.QuickCalcPage })));
const DetailedCalcPage = lazy(() => import('@/pages/calc/DetailedCalcPage').then((m) => ({ default: m.DetailedCalcPage })));
const UnsavedResultPage = lazy(() => import('@/pages/calc/ResultPages').then((m) => ({ default: m.UnsavedResultPage })));
const SavedResultPage = lazy(() => import('@/pages/calc/ResultPages').then((m) => ({ default: m.SavedResultPage })));
const SharedResultPage = lazy(() => import('@/pages/calc/ResultPages').then((m) => ({ default: m.SharedResultPage })));
const CalculationsPage = lazy(() => import('@/pages/calc/CalculationsPage').then((m) => ({ default: m.CalculationsPage })));
const CompareCalculationsPage = lazy(() => import('@/pages/calc/CalculationsPage').then((m) => ({ default: m.CompareCalculationsPage })));
const FinancingPage = lazy(() => import('@/pages/calc/FinancingPage').then((m) => ({ default: m.FinancingPage })));
const OutagePage = lazy(() => import('@/pages/calc/OutagePage').then((m) => ({ default: m.OutagePage })));
const MapPage = lazy(() => import('@/pages/map/MapPage').then((m) => ({ default: m.MapPage })));
const SitesPage = lazy(() => import('@/pages/map/SitesPage').then((m) => ({ default: m.SitesPage })));
const SiteDetailPage = lazy(() => import('@/pages/map/SiteDetailPage').then((m) => ({ default: m.SiteDetailPage })));
const AdminTariffsPage = lazy(() => import('@/pages/admin/calc/AdminTariffsPage').then((m) => ({ default: m.AdminTariffsPage })));
const AdminCalcSettingsPage = lazy(() => import('@/pages/admin/calc/AdminCalcSettingsPage').then((m) => ({ default: m.AdminCalcSettingsPage })));
const AdminShopsPage = lazy(() => import('@/pages/admin/shops/AdminShopsPage').then((m) => ({ default: m.AdminShopsPage })));
const AdminShopDetailPage = lazy(() => import('@/pages/admin/shops/AdminShopDetailPage').then((m) => ({ default: m.AdminShopDetailPage })));
const AdminCatalogPage = lazy(() => import('@/pages/admin/catalog/AdminCatalogPage').then((m) => ({ default: m.AdminCatalogPage })));
const CustomerRequestsPage = lazy(() => import('@/pages/deals/CustomerRequestsPages').then((m) => ({ default: m.CustomerRequestsPage })));
const CustomerRequestDetailPage = lazy(() => import('@/pages/deals/CustomerRequestsPages').then((m) => ({ default: m.CustomerRequestDetailPage })));
const CustomerQuotePage = lazy(() => import('@/pages/deals/CustomerRequestsPages').then((m) => ({ default: m.CustomerQuotePage })));
const CompareQuotesPage = lazy(() => import('@/pages/deals/CustomerRequestsPages').then((m) => ({ default: m.CompareQuotesPage })));
const CustomerConversationsPage = lazy(() => import('@/pages/deals/ConversationsPage').then((m) => ({ default: m.CustomerConversationsPage })));
const InstallationPage = lazy(() => import('@/pages/deals/InstallationPage').then((m) => ({ default: m.InstallationPage })));
const CustomerInstallationsPage = lazy(() => import('@/pages/deals/InstallationPage').then((m) => ({ default: m.CustomerInstallationsPage })));
const ShopInstallationsPage = lazy(() => import('@/pages/deals/InstallationPage').then((m) => ({ default: m.ShopInstallationsPage })));
const ShopRequestsPage = lazy(() => import('@/pages/deals/ShopRequestsPages').then((m) => ({ default: m.ShopRequestsPage })));
const ShopRequestDetailPage = lazy(() => import('@/pages/deals/ShopRequestsPages').then((m) => ({ default: m.ShopRequestDetailPage })));
const ShopReviewsPage = lazy(() => import('@/pages/deals/MiscDealsPages').then((m) => ({ default: m.ShopReviewsPage })));
const FavoritesPage = lazy(() => import('@/pages/deals/MiscDealsPages').then((m) => ({ default: m.FavoritesPage })));
const AdminModerationPage = lazy(() => import('@/pages/admin/moderation/AdminModerationPage').then((m) => ({ default: m.AdminModerationPage })));
const KnowledgeHomePage = lazy(() => import('@/pages/m7/KnowledgePages').then((m) => ({ default: m.KnowledgeHomePage })));
const KnowledgeCategoryPage = lazy(() => import('@/pages/m7/KnowledgePages').then((m) => ({ default: m.KnowledgeCategoryPage })));
const ArticlePage = lazy(() => import('@/pages/m7/KnowledgePages').then((m) => ({ default: m.ArticlePage })));
const HelpCenterPage = lazy(() => import('@/pages/m7/SupportPages').then((m) => ({ default: m.HelpCenterPage })));
const TicketsPage = lazy(() => import('@/pages/m7/SupportPages').then((m) => ({ default: m.TicketsPage })));
const TicketPage = lazy(() => import('@/pages/m7/SupportPages').then((m) => ({ default: m.TicketPage })));
const CustomerDashboardPage = lazy(() => import('@/pages/m7/CabinetPages').then((m) => ({ default: m.CustomerDashboardPage })));
const SystemsPage = lazy(() => import('@/pages/m7/CabinetPages').then((m) => ({ default: m.SystemsPage })));
const SystemPage = lazy(() => import('@/pages/m7/CabinetPages').then((m) => ({ default: m.SystemPage })));
const PortfolioPage = lazy(() => import('@/pages/m7/ShopM7Pages').then((m) => ({ default: m.PortfolioPage })));
const WidgetPage = lazy(() => import('@/pages/m7/ShopM7Pages').then((m) => ({ default: m.WidgetPage })));
const AnalyticsPage = lazy(() => import('@/pages/m7/ShopM7Pages').then((m) => ({ default: m.AnalyticsPage })));
const AdminSupportPage = lazy(() => import('@/pages/m7/AdminM7Pages').then((m) => ({ default: m.AdminSupportPage })));
const AdminTicketPage = lazy(() => import('@/pages/m7/AdminM7Pages').then((m) => ({ default: m.AdminTicketPage })));
const AdminContentPage = lazy(() => import('@/pages/m7/AdminM7Pages').then((m) => ({ default: m.AdminContentPage })));
const AdminArticleEditorPage = lazy(() => import('@/pages/m7/AdminM7Pages').then((m) => ({ default: m.AdminArticleEditorPage })));
const AdminHomeBlocksPage = lazy(() => import('@/pages/m7/AdminHomeBlocksPage').then((m) => ({ default: m.AdminHomeBlocksPage })));
const DevUiPage = lazy(() => import('@/pages/dev/DevUiPage').then((m) => ({ default: m.DevUiPage })));
const PortalPreviewPage = lazy(() => import('@/pages/landing/portal/PortalPage').then((m) => ({ default: () => <m.PortalPage preview /> })));
const AdminReportsPage = lazy(() => import('@/pages/m7/AdminM7Pages').then((m) => ({ default: m.AdminReportsPage })));
const ShopDashboardPage = lazy(() => import('@/pages/shop/ShopDashboardPage').then((m) => ({ default: m.ShopDashboardPage })));
const ShopCatalogPage = lazy(() => import('@/pages/shop/ShopCatalogPage').then((m) => ({ default: m.ShopCatalogPage })));
const ShopImportPage = lazy(() => import('@/pages/shop/ShopImportPage').then((m) => ({ default: m.ShopImportPage })));
const ShopBranchesPage = lazy(() => import('@/pages/shop/ShopBranchesPage').then((m) => ({ default: m.ShopBranchesPage })));
const ShopServicesPage = lazy(() => import('@/pages/shop/ShopServicesPage').then((m) => ({ default: m.ShopServicesPage })));
const ShopOwnProfilePage = lazy(() => import('@/pages/shop/ShopOwnProfilePage').then((m) => ({ default: m.ShopOwnProfilePage })));
const FirstPasswordPage = lazy(() => import('@/pages/auth/FirstPasswordPage').then((m) => ({ default: m.FirstPasswordPage })));
const ShopMembersPage = lazy(() => import('@/pages/shop/ShopMembersPage').then((m) => ({ default: m.ShopMembersPage })));

const only = (roles: Role[], element: ReactNode) => <RoleGuard roles={roles}>{element}</RoleGuard>;
const customer = (el: ReactNode) => only(['CUSTOMER'], el);
const shop = (el: ReactNode) => only(['SHOP'], <><SuspendedBanner />{el}</>);
const admin = (el: ReactNode) => only(['ADMIN'], el);

const open = (el: ReactNode) => <PublicCustomerRoute>{el}</PublicCustomerRoute>;

/** React Router v7 xatti-harakatini oldindan yoqish (future-flag ogohlantirishlari yo‘q). */
const ROUTER_OPTIONS = { future: { v7_relativeSplatPath: true, v7_fetcherPersist: true, v7_normalizeFormMethod: true, v7_partialHydration: true, v7_skipActionErrorRevalidation: true } } as const;

const panelRouter = createBrowserRouter([
  {
    element: <RootShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <PanelRoot /> },
      { path: '/shartlar', element: <TermsPage /> },
      { path: '/maxfiylik', element: <TermsPage /> },
      // Admin: bosh sahifani qoralamalar bilan to‘liq ekranda ko‘rish (panel menyusisiz).
      { path: '/admin/bosh-sahifa/korinish', element: <ProtectedRoute>{admin(<Suspense fallback={<PageLoader />}><PortalPreviewPage /></Suspense>)}</ProtectedRoute> },
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <RedirectIfAuthed><LoginPage /></RedirectIfAuthed> },
          // Do‘kon paneli: ro‘yxatdan o‘tish va OTP yo‘q — hisobni admin yaratadi, kirish login + parol (TZ 6.4).
          { path: '/register', element: env.appRole === 'SHOP' ? <Navigate to="/login" replace /> : <RedirectIfAuthed><RegisterPage /></RedirectIfAuthed> },
          { path: '/otp', element: env.appRole === 'SHOP' ? <Navigate to="/login" replace /> : <OtpPage /> },
          { path: FIRST_PASSWORD_PATH, element: <Suspense fallback={<PageLoader />}><FirstPasswordPage /></Suspense> },
        ],
      },
      {
        // Mijoz panelining ochiq sahifalari: guest ham ko‘radi (TZ 5.4, U7.4–U7.5).
        element: <MainLayout />,
        children: [
          { path: '/mijoz/mahsulotlar', element: open(<CatalogPage />) },
          { path: '/mijoz/mahsulotlar/:slug', element: open(<ProductPage />) },
          { path: '/mijoz/solishtirish', element: open(<ComparePage />) },
          { path: '/mijoz/dokonlar', element: open(<ShopsPage />) },
          { path: '/mijoz/xarita', element: open(<MapPage />) },
          { path: '/mijoz/kalkulyator', element: open(<QuickCalcPage />) },
          { path: '/mijoz/kalkulyator/batafsil', element: open(<DetailedCalcPage />) },
          { path: '/mijoz/kalkulyator/natija', element: open(<UnsavedResultPage />) },
          { path: '/mijoz/kredit', element: open(<FinancingPage />) },
          { path: '/mijoz/uzilish', element: open(<OutagePage />) },
          { path: '/mijoz/ulashish/:token', element: open(<SharedResultPage />) },
          { path: '/mijoz/dokonlar/:slug', element: open(<ShopProfilePage />) },
          { path: '/mijoz/bilim', element: open(<KnowledgeHomePage />) },
          { path: '/mijoz/bilim/:category', element: open(<KnowledgeCategoryPage />) },
          { path: '/mijoz/bilim/:category/:slug', element: open(<ArticlePage />) },
          { path: '/mijoz/yordam', element: open(<HelpCenterPage />) },
        ],
      },
      {
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        ),
        children: [
          // ── Mijoz paneli (guest ham ko‘radigan sahifalar M5 da /mijoz/kalkulyator va h.k.) ──
          { path: '/mijoz/hisoblar', element: customer(<CalculationsPage />) },
          { path: '/mijoz/hisoblar/solishtirish', element: customer(<CompareCalculationsPage />) },
          { path: '/mijoz/natija/:id', element: customer(<SavedResultPage />) },
          { path: '/mijoz/obyektlar', element: customer(<SitesPage />) },
          { path: '/mijoz/obyektlar/:id', element: customer(<SiteDetailPage />) },
          { path: '/mijoz/sorovlar', element: customer(<CustomerRequestsPage />) },
          { path: '/mijoz/sorovlar/:id', element: customer(<CustomerRequestDetailPage />) },
          { path: '/mijoz/sorovlar/:id/solishtirish', element: customer(<CompareQuotesPage />) },
          { path: '/mijoz/takliflar/:id', element: customer(<CustomerQuotePage />) },
          { path: '/mijoz/chat', element: customer(<CustomerConversationsPage />) },
          { path: '/mijoz/chat/:rsId', element: customer(<CustomerConversationsPage />) },
          { path: '/mijoz/montajlar', element: customer(<CustomerInstallationsPage />) },
          { path: '/mijoz/montajlar/:id', element: customer(<InstallationPage />) },
          { path: '/mijoz/sevimlilar', element: customer(<FavoritesPage />) },
          { path: '/mijoz/bosh', element: customer(<CustomerDashboardPage />) },
          { path: '/mijoz/tizimim', element: customer(<SystemsPage />) },
          { path: '/mijoz/tizimim/:id', element: customer(<SystemPage />) },
          // Eski havola: bitta montaj sahifasi — /mijoz/montajlar/:id (A-12).
          { path: '/mijoz/montaj/:id', element: <LegacyInstallationRedirect /> },
          { path: '/mijoz/murojaatlar', element: customer(<TicketsPage />) },
          { path: '/mijoz/murojaatlar/:id', element: customer(<TicketPage />) },
          { path: '/mijoz/profil', element: customer(<CustomerProfilePage />) },
          { path: '/mijoz/profil/:section', element: <Navigate to="/sozlamalar" replace /> },
          // ── Do‘kon paneli ──
          { path: '/dokon', element: shop(<ShopDashboardPage />) },
          { path: '/dokon/sorovlar', element: shop(<ShopRequestsPage key="all" />) },
          { path: '/dokon/sorovlar/:rsId', element: shop(<ShopRequestDetailPage />) },
          { path: '/dokon/takliflar', element: shop(<ShopRequestsPage key="quoted" quotedOnly />) },
          { path: '/dokon/montajlar', element: shop(<ShopInstallationsPage />) },
          { path: '/dokon/montajlar/:id', element: shop(<InstallationPage />) },
          { path: '/dokon/sharhlar', element: shop(<ShopReviewsPage />) },
          { path: '/dokon/profil', element: shop(<ShopOwnProfilePage />) },
          { path: '/dokon/katalog', element: shop(<ShopCatalogPage />) },
          { path: '/dokon/import', element: shop(<ShopImportPage />) },
          { path: '/dokon/xizmatlar', element: shop(<ShopServicesPage />) },
          { path: '/dokon/filiallar', element: shop(<ShopBranchesPage />) },
          { path: '/dokon/portfolio', element: shop(<PortfolioPage />) },
          { path: '/dokon/vidjet', element: shop(<WidgetPage />) },
          { path: '/dokon/chat', element: <Navigate to="/dokon/sorovlar" replace /> },
          { path: '/dokon/analitika', element: shop(<AnalyticsPage />) },
          { path: '/dokon/xodimlar', element: shop(<ShopMembersPage />) },
          // ── Admin paneli ──
          { path: '/admin', element: admin(<AdminHome />) },
          { path: '/admin/hisobot', element: admin(<AdminReportsPage />) },
          { path: '/admin/foydalanuvchilar', element: admin(<AdminUsersPage />) },
          { path: '/admin/foydalanuvchilar/:id', element: admin(<AdminUserProfilePage />) },
          { path: '/admin/adminlar', element: admin(<AdminAdminsPage />) },
          { path: '/admin/dokonlar', element: admin(<AdminShopsPage key="all" />) },
          { path: '/admin/dokonlar/:id', element: admin(<AdminShopDetailPage />) },
          { path: '/admin/katalog', element: admin(<AdminCatalogPage />) },
          { path: '/admin/sharhlar', element: admin(<AdminModerationPage />) },
          { path: '/admin/tariflar', element: admin(<AdminTariffsPage />) },
          { path: '/admin/kalkulyator', element: admin(<AdminCalcSettingsPage />) },
          { path: '/admin/yordam', element: admin(<AdminSupportPage />) },
          { path: '/admin/yordam/:id', element: admin(<AdminTicketPage />) },
          { path: '/admin/bosh-sahifa', element: admin(<AdminHomeBlocksPage />) },
          { path: '/admin/kontent', element: admin(<AdminContentPage />) },
          { path: '/admin/kontent/:id', element: admin(<AdminArticleEditorPage />) },
          { path: '/admin/siyosatlar', element: admin(<AdminPoliciesPage />) },
          { path: '/admin/audit', element: admin(<AdminAuditPage />) },
          { path: '/admin/errorlar', element: admin(<AdminErrorsPage />) },
          { path: '/admin/profil', element: admin(<AdminProfilePage />) },
          { path: '/admin/devops', element: admin(<AdminDevOpsPage />) },
          { path: '/bildirishnomalar', element: <NotificationsPage /> },
          { path: '/sozlamalar', element: <SettingsPage /> },
          { path: '/sozlamalar/:section', element: <SettingsPage /> },
          // Komponentlar ko‘rgazmasi — faqat dev rejimida (production bundle’ga tushmaydi).
          ...(import.meta.env.DEV ? [{ path: '/dev/ui', element: <DevUiPage /> }] : []),
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], ROUTER_OPTIONS);

/** Asosiy sayt (quyosh.uz, rol belgilanmagan): faqat tushuntirish va yo‘naltirish (U7.1). */
const portalRouter = createBrowserRouter([
  {
    element: <RootShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <RoleSelectPage /> },
      { path: '/shartlar', element: <TermsPage /> },
      { path: '/maxfiylik', element: <TermsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], ROUTER_OPTIONS);

export const router = env.appRole ? panelRouter : portalRouter;
