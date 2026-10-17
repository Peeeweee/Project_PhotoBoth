import { lazy, Suspense } from "react";
import { useRoomStore } from "./state/useRoomStore";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Layout, PageTransition } from "./components/layout";
import Landing from "./pages/Landing";
import Lobby from "./pages/Lobby";
const ThemeSelect = lazy(() => import("./pages/ThemeSelect"));
const LayoutSelect = lazy(() => import("./pages/LayoutSelect"));
const DesignSelect = lazy(() => import("./pages/DesignSelect"));
const CaptureRoom = lazy(() => import("./pages/CaptureRoom"));
const EditorRoom = lazy(() => import("./pages/EditorRoom"));
const FilterRoom = lazy(() => import("./pages/FilterRoom"));
const DecorateRoom = lazy(() => import("./pages/DecorateRoom"));
const ExportRoom = lazy(() => import("./pages/ExportRoom"));
const DoneRoom = lazy(() => import("./pages/DoneRoom"));
import { useApplyTheme } from "./hooks/useApplyTheme";
import { ErrorBoundary } from "./ErrorBoundary";

/** Mounts inside the Router so the Zustand store is reachable; renders nothing. */
function ThemeApplicator() {
  useApplyTheme();
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  const { sessionToken: identity, isHost, status, stage } = useRoomStore();
  if (location.pathname !== "/" && !identity)
    return <Navigate to={`/${location.search}`} replace />;
  if (
    identity &&
    !isHost &&
    ["/layout", "/theme", "/design"].includes(location.pathname)
  )
    return <Navigate to="/lobby" replace />;
  if (
    identity &&
    ["/editor", "/filter", "/decorate", "/export", "/done"].includes(
      location.pathname,
    ) &&
    ["waiting", "ready", "capturing"].includes(status)
  )
    return (
      <Navigate
        to={
          status === "capturing" || (status === "ready" && stage === "capture")
            ? "/capture"
            : "/lobby"
        }
        replace
      />
    );
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Landing />
            </PageTransition>
          }
        />
        <Route
          path="/lobby"
          element={
            <PageTransition>
              <Lobby />
            </PageTransition>
          }
        />
        <Route
          path="/theme"
          element={
            <PageTransition>
              <ThemeSelect />
            </PageTransition>
          }
        />
        <Route
          path="/layout"
          element={
            <PageTransition>
              <LayoutSelect />
            </PageTransition>
          }
        />
        <Route
          path="/design"
          element={
            <PageTransition>
              <DesignSelect />
            </PageTransition>
          }
        />
        <Route
          path="/capture"
          element={
            <PageTransition>
              <CaptureRoom />
            </PageTransition>
          }
        />
        <Route
          path="/editor"
          element={
            <PageTransition>
              <EditorRoom />
            </PageTransition>
          }
        />
        <Route
          path="/filter"
          element={
            <PageTransition>
              <FilterRoom />
            </PageTransition>
          }
        />
        <Route
          path="/decorate"
          element={
            <PageTransition>
              <DecorateRoom />
            </PageTransition>
          }
        />
        <Route
          path="/export"
          element={
            <PageTransition>
              <ExportRoom />
            </PageTransition>
          }
        />
        <Route
          path="/done"
          element={
            <PageTransition>
              <DoneRoom />
            </PageTransition>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeApplicator />
      <Layout>
        <ErrorBoundary>
          <Suspense
            fallback={
              <p role="status" style={{ padding: 24 }}>
                Loading your booth…
              </p>
            }
          >
            <AnimatedRoutes />
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  );
}
