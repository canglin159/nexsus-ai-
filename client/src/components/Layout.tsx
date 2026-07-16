import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">NX</span>
              </div>
              <span className="text-xl font-bold text-foreground">Nexus Exchange</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link to="/listings" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Browse
              </Link>
              {user ? (
                <>
                  {user.role === "seller" && (
                    <Link to="/listings/new" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Create Listing
                    </Link>
                  )}
                  <Link to={user.role === "seller" ? "/dashboard/seller" : "/dashboard/buyer"} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Dashboard
                  </Link>
                  {user.role === "admin" && (
                    <Link to="/dashboard/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Admin
                    </Link>
                  )}
                  <div className="flex items-center gap-3 pl-4 border-l border-border">
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                    <button
                      onClick={() => { logout(); navigate("/"); }}
                      className="text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 pl-4 border-l border-border">
                  <Link to="/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">NX</span>
              </div>
              <span className="text-sm font-semibold text-foreground">Nexus Exchange</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Nexus Exchange. AI-Powered Marketplace Brokerage.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}