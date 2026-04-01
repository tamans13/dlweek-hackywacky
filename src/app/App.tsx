import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AppDataProvider } from "./state/AppDataContext";
import { ExtensionBridge } from "./components/ExtensionBridge";
import { AuthProvider } from "../contexts/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <ExtensionBridge />
        <RouterProvider router={router} />
      </AppDataProvider>
    </AuthProvider>
  );
}
