import { useCallback, useState } from "react";
import { getToken, setToken } from "./api";
import Login from "./login";
import Dashboard from "./Dashboard";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);

  const handleLogout = useCallback(() => {
    setToken(null);
    setLoggedIn(false);
  }, []);

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  return <Dashboard onLogout={handleLogout} />;
}