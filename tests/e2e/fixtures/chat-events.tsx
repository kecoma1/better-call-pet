import { createRoot } from "react-dom/client";
import Chat from "../../../src/components/chat";
import "../../../src/style.css";
import "../../../src/pages/chat.css";
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { unmountChat: () => root.unmount() });
root.render(
  <div className="app-shell chat-layout">
    <main className="chat-main">
      <Chat live view="page" items={[]} onRefresh={async () => {}} />
    </main>
  </div>,
);
