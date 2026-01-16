// CONFIGURACIÓN GESTIONADA POR LOCALSTORAGE Y CONFIG.JS
// Seguridad: Las claves no se guardan en código, sino en el navegador del usuario o config.js (ignorado).

let currentDenuncia = {};

// CONFIG HELPER
function getConfiguration() {
    const localKey = localStorage.getItem('GEMINI_API_KEY');
    const localUrl = localStorage.getItem('GOOGLE_SCRIPT_URL');

    let configKey = null;
    let configUrl = null;

    if (window.CONFIG) {
        // Aceptamos la clave si existe y no es el placeholder original
        if (window.CONFIG.GEMINI_API_KEY && window.CONFIG.GEMINI_API_KEY !== "PEGA_TU_API_KEY_AQUI") {
            configKey = window.CONFIG.GEMINI_API_KEY;
        }
        if (window.CONFIG.GOOGLE_SCRIPT_URL) {
            configUrl = window.CONFIG.GOOGLE_SCRIPT_URL;
        }
    }

    return {
        apiKey: configKey || localKey,
        scriptUrl: configUrl || localUrl
    };
}

// SCHEMAS
const complaintSchema = {
    type: "OBJECT",
    properties: {
        fecha: { type: "STRING" },
        tecnico: { type: "STRING" },
        distrito: { type: "STRING" },
        nombre: { type: "STRING" },
        contacto: { type: "STRING" },
        categoria: { type: "STRING" },
        peticion: { type: "STRING" },
        direccion: { type: "STRING" },
        urgencia: { type: "STRING" }
    },
    required: ["fecha", "tecnico", "distrito", "nombre", "contacto", "categoria", "peticion", "direccion", "urgencia"]
};

// INITIALIZATION
window.onload = () => {
    // Check if configuration exists
    const { apiKey, scriptUrl } = getConfiguration();

    if (!apiKey || !scriptUrl) {
        // First run or missing config
        setTimeout(() => {
            showToast("Configura tus credenciales para empezar", "info");
            openSettings();
        }, 1000);
    }
}

// SETTINGS MODULE
function openSettings() {
    const modal = document.getElementById('settings-modal');
    const panel = document.getElementById('settings-panel');

    // Load current values
    const config = getConfiguration();
    document.getElementById('input-gemini-key').value = config.apiKey || '';
    document.getElementById('input-script-url').value = config.scriptUrl || '';

    if (window.CONFIG && window.CONFIG.GEMINI_API_KEY && window.CONFIG.GEMINI_API_KEY !== "PEGA_TU_API_KEY_AQUI") {
        showToast("ℹ️ Usando API Key de config.js", "info");
    }

    modal.classList.remove('hidden');
    // Small delay for transition
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        panel.classList.remove('scale-95');
        panel.classList.add('scale-100');
    }, 10);
}

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    const panel = document.getElementById('settings-panel');

    modal.classList.add('opacity-0');
    panel.classList.remove('scale-100');
    panel.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function saveSettings() {
    const key = document.getElementById('input-gemini-key').value.trim();
    const url = document.getElementById('input-script-url').value.trim();

    if (key) localStorage.setItem('GEMINI_API_KEY', key);
    if (url) localStorage.setItem('GOOGLE_SCRIPT_URL', url);

    showToast("Configuración guardada seguramente", "success");
    closeSettings();
}

// UTILS: TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'loading') icon = '⏳';
    if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `<span class="text-lg">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Remove automatically
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// API: GEMINI CALLER
async function callGemini(prompt, systemPrompt, schema = null) {
    const { apiKey } = getConfiguration(); // Check if configuration exists
    if (!apiKey) {
        // Fallback for demo purposes if key is missing, or prompt user
        // En un entorno real, esto fallaría. 
        // Para que funcione al Usuario, el sistema "Identity" suele inyectar la key o 
        // nosotros la pedimos.
        console.warn("No API Key configured inside script.js");
        throw new Error("Gemini API Key is not configured.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    if (schema) {
        payload.generationConfig = {
            responseMimeType: "application/json",
            responseSchema: schema
        };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        console.error("Gemini Error:", e);
        throw e;
    }
}

// MAIN ACTIONS
async function analyzeComplaint() {
    const input = document.getElementById('raw-complaint-input').value.trim();
    if (!input) return showToast("Por favor ingresa el texto de la denuncia.", "error");

    document.getElementById('spinner-analyze').classList.remove('hidden');
    showToast("Analizando con Inteligencia Artificial...", "loading");

    try {
        const sys = `Eres un experto analista de denuncias municipales. 
        Extrae la información del texto entregado.
        - Fecha: Usar fecha actual (YYYY-MM-DD) si no se menciona.
        - Distrito: Inferir o poner "sin dato".
        - Categorías posibles: Recoleccion de voluminiosos, Alumbrado, Baches, Zonas Verdes, Informacion CAM, URBANO.`;

        const result = await callGemini(input, sys, complaintSchema);
        const data = JSON.parse(result);

        // Generate pseudo-ID
        data.id = `CASE-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
        data.status = "Nuevo"; // Default status

        currentDenuncia = data;
        renderResults(data);

        // Reveal result card with animation
        const resCard = document.getElementById('analysis-result');
        resCard.classList.remove('opacity-50', 'pointer-events-none');
        resCard.classList.add('opacity-100');

        showToast("Análisis completado con éxito.", "success");

    } catch (err) {
        showToast("Error al conectar con Gemini. Revisa la consola/API Key.", "error");
    } finally {
        document.getElementById('spinner-analyze').classList.add('hidden');
    }
}

function renderResults(data) {
    document.getElementById('display-urgencia').innerHTML = `<span class="${getUrgenciaColor(data.urgencia)}">${data.urgencia}</span>`;
    document.getElementById('display-categoria').textContent = data.categoria;
    document.getElementById('display-id').textContent = data.id;
    document.getElementById('display-nombre').textContent = data.nombre || "Anónimo";
    document.getElementById('display-contacto').textContent = data.contacto ? `(${data.contacto})` : "";
    document.getElementById('display-direccion').textContent = data.direccion;
    document.getElementById('display-distrito').textContent = data.distrito;
    document.getElementById('display-peticion').textContent = data.peticion;

    // Pre-generate internal report
    document.getElementById('reporte-dependencia').textContent = `
[REPORTE MUNICIPAL # ${data.id}]
--------------------------------
PRIORIDAD: ${data.urgencia.toUpperCase()}
CATEGORÍA: ${data.categoria}
FECHA: ${data.fecha}

CIUDADANO: ${data.nombre}
CONTACTO: ${data.contacto}
UBICACIÓN: ${data.direccion}

DETALLE DEL PROBLEMA:
${data.peticion}
--------------------------------
`.trim();

    // Pre-generate citizen response
    document.getElementById('respuesta-ciudadano').textContent = `Estimado(a) ${data.nombre || 'Vecino'},

Hemos recibido su reporte con ID: ${data.id}.
Nuestro equipo de ${data.categoria} ha sido notificado. Debido a la clasificación de urgencia ${data.urgencia}, estaremos atendiendo su solicitud a la brevedad posible.

Gracias por contribuir a mejorar San Salvador Este.
Atte. Gestión Municipal`.trim();
}

function getUrgenciaColor(urgencia) {
    const u = urgencia.toLowerCase();
    if (u.includes('alta')) return 'text-red-600';
    if (u.includes('media')) return 'text-yellow-600';
    return 'text-green-600';
}

async function optimizarPeticion() {
    if (!currentDenuncia.peticion) return;
    showToast("Mejorando redacción técnica...", "loading");
    try {
        const prompt = `Reescribe esta queja ciudadana en lenguaje técnico profesional para un ingeniero civil o jefe de cuadrilla, siendo conciso y claro: "${currentDenuncia.peticion}"`;
        const res = await callGemini(prompt, "Eres un redactor técnico.");
        currentDenuncia.peticion = res;
        document.getElementById('display-peticion').textContent = res;
        renderResults(currentDenuncia); // Re-render to update dependent texts
        showToast("Redacción optimizada.", "success");
    } catch (e) {
        showToast("Error al optimizar.", "error");
    }
}

async function generarPlanTecnico() {
    if (!currentDenuncia.peticion) return showToast("Primero analiza una denuncia.", "error");
    const box = document.getElementById('ai-plan-box');
    box.innerHTML = '<span class="animate-pulse">Generando estrategia...</span>';

    try {
        const prompt = `Genera un plan de acción de 3 pasos (Inspección, Ejecución, Cierre) para resolver este problema: ${currentDenuncia.peticion} en categoría ${currentDenuncia.categoria}.`;
        const res = await callGemini(prompt, "Eres un jefe de operaciones municipales. Usa formato Markdown simple (sin negritas exageradas).");
        box.innerHTML = res.replace(/\n/g, '<br>');
        showToast("Plan generado.", "success");
    } catch (e) {
        showToast("Error generando plan.", "error");
        box.textContent = "Error o timeout.";
    }
}

async function traducirRespuesta(lang) {
    const box = document.getElementById('respuesta-ciudadano');
    const text = box.innerText;
    showToast("Traduciendo...", "loading");

    try {
        const target = lang === 'en' ? 'Inglés' : 'Francés';
        const res = await callGemini(`Traduce esto al ${target}: \n${text}`, "Eres un traductor oficial.");
        box.textContent = res;
        showToast("Traducción lista.", "success");
    } catch (e) {
        showToast("Error de traducción.", "error");
    }
}

// GOOGLE SHEETS INTEGRATION
async function sendToGoogleSheet() {
    const { scriptUrl } = getConfiguration();
    if (!scriptUrl) {
        return showToast("⚠️ ERROR: No has configurado la URL del Script. Revisa el archivo google_apps_script.js y configúralo en script.js.", "error");
    }
    if (!currentDenuncia.id) {
        return showToast("No hay datos para enviar.", "error");
    }

    const btn = document.getElementById('btn-save-sheet');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Enviando...';
    btn.disabled = true;

    try {
        // We use 'no-cors' needed for Google Apps Script Web App simple triggers usually, 
        // BUT 'no-cors' means we can't read the response JSON. 
        // Standard practice for simple logging is okay.
        // For reading response, we need redirect handling or proper CORS setup in script (difficult in GAS).
        // We will try standard fetch first.

        await fetch(scriptUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentDenuncia)
        });

        showToast("Datos enviados a Google Sheets (Modo ciego/no-cors).", "success");
    } catch (error) {
        console.error(error);
        showToast("Error al enviar. Revisa la consola.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function generarYDescargarCSV() {
    if (!currentDenuncia.id) return showToast("Sin datos.", "error");

    const headers = Object.keys(currentDenuncia).join(",");
    const values = Object.values(currentDenuncia).map(v => `"${v}"`).join(",");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + values;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `denuncia_${currentDenuncia.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function copiarTexto(id) {
    const text = document.getElementById(id).innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast("Copiado al portapapeles", "success");
    });
}
