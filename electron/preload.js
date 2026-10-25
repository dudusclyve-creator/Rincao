// Ponte segura entre a pagina (painel) e o processo principal.
// Usada para abrir o WhatsApp Desktop direto, sem passar pelo navegador.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rincao", {
  // phone: so digitos (ex.: 5555999999999) / text: mensagem opcional
  openWhatsApp: (phone, text) => ipcRenderer.invoke("open-whatsapp", { phone, text }),
  whatsappDesktop: () => ipcRenderer.invoke("whatsapp-desktop"),
});
