/**
 * Google Apps Script para recibir denuncias desde la aplicación web
 * 
 * INSTRUCCIONES DE CONFIGURACIÓN:
 * 
 * 1. Abre tu Google Sheet donde quieres guardar las denuncias
 * 2. Ve a Extensiones > Apps Script
 * 3. Borra el código por defecto y pega este script completo
 * 4. Guarda el proyecto (Ctrl+S)
 * 5. Haz clic en "Implementar" > "Nueva implementación"
 * 6. Selecciona tipo: "Aplicación web"
 * 7. Configuración:
 *    - Descripción: "API de Denuncias"
 *    - Ejecutar como: "Yo"
 *    - Quién tiene acceso: "Cualquier persona"
 * 8. Haz clic en "Implementar"
 * 9. Autoriza los permisos cuando te lo pida
 * 10. Copia la URL de la aplicación web que te da
 * 11. Pega esa URL en config.js en GOOGLE_SCRIPT_URL
 */

function doPost(e) {
    try {
        // Obtener la hoja activa (o especifica el nombre de tu hoja)
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        // Si es la primera vez, crear encabezados
        if (sheet.getLastRow() === 0) {
            sheet.appendRow([
                'Fecha',
                'ID',
                'Técnico',
                'Distrito',
                'Nombre',
                'Contacto',
                'Categoría',
                'Petición',
                'Dirección',
                'Estado',
                'Timestamp'
            ]);
        }

        // Parsear los datos recibidos
        const data = JSON.parse(e.postData.contents);

        // Agregar nueva fila con los datos
        sheet.appendRow([
            data.fecha || '',
            data.id || '',
            data.tecnico || '',
            data.distrito || '',
            data.nombre || '',
            data.contacto || '',
            data.categoria || '',
            data.peticion || '',
            data.direccion || '',
            data.urgencia || '',
            data.status || 'Nuevo',
            new Date().toLocaleString('es-SV')
        ]);

        // Respuesta exitosa
        return ContentService
            .createTextOutput(JSON.stringify({
                success: true,
                message: 'Denuncia guardada correctamente',
                id: data.id
            }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        // Respuesta de error
        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                error: error.toString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Función de prueba (opcional)
function testDoPost() {
    const testData = {
        postData: {
            contents: JSON.stringify({
                fecha: '2026-01-15',
                id: 'TEST-001',
                tecnico: 'Juan Pérez',
                distrito: 'Centro',
                nombre: 'María González',
                contacto: '7090-1234',
                categoria: 'Recolección de voluminiosos',
                peticion: 'Solicito recolección de muebles viejos',
                direccion: 'Calle Principal #123',
                urgencia: 'Media',
                status: 'Nuevo'
            })
        }
    };

    const result = doPost(testData);
    Logger.log(result.getContent());
}
