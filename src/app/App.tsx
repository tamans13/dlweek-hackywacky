import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AppDataProvider } from "./state/AppDataContext";
import { ExtensionBridge } from "./components/ExtensionBridge";

export default function App() {
  return (
    <AppDataProvider>
      <ExtensionBridge />
      <RouterProvider router={router} />
    </AppDataProvider>
  );
}
