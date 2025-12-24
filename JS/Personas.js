// ==========================================
// CONFIGURACIÓN INICIAL Y ENDPOINTS
// ==========================================
const BASE_URL = 'https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api';

const API_URL_GET_ALL = `${BASE_URL}/Person`;        
const API_URL_CREATE  = `${BASE_URL}/Person`;        
const API_URL_UPDATE  = `${BASE_URL}/Person`;        
const API_URL_DOC_TYPES = `${BASE_URL}/DocumentType/select`; 

let modalAbierto = false;
let isEditMode = false;
let editingId = null;

// Paginación
let currentPage = 1;
let currentPageSize = 10;
let totalPages = 1;
let totalCount = 0;
let hasNextPage = false;
let hasPreviousPage = false;

// Datos
let personasCache = [];
let tiposDocumentoCache = [];
let searchTerm = '';
let debounceTimer = null;

// Elementos DOM
const modal = document.getElementById('modalPersona');
const form = document.getElementById('formPersona');
const modalTitle = document.getElementById('modalTitle');
const btnGuardar = document.getElementById('btnGuardar');
const selectTipoDoc = document.getElementById('tipoDocumento');
const inputNumDoc = document.getElementById('numeroDocumento');

// APLICAR CAMBIO SOLICITADO: MÁXIMO 25 DÍGITOS
if (inputNumDoc) {
    inputNumDoc.setAttribute('maxlength', '25');
}

// CONFIGURACIÓN TOASTR (Igual que Ventas/Compras)
toastr.options = { 
    "closeButton": true, 
    "progressBar": true, 
    "positionClass": "toast-bottom-right", 
    "timeOut": "4000",
    "preventDuplicates": false 
};

// ==========================================
// CARGA DE TIPOS DE DOCUMENTO
// ==========================================
async function cargarTiposDocumento() {
    try {
        const response = await fetch(API_URL_DOC_TYPES);
        if (!response.ok) throw new Error('Error al cargar tipos');
        const data = await response.json();
        tiposDocumentoCache = data;
        
        selectTipoDoc.innerHTML = '<option value="">Seleccionar...</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            const textoMostrar = item.description || item.name || item.text;
            option.textContent = textoMostrar;
            
            // Validar (DNI, RUC limpios)
            const textoValidar = (textoMostrar || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            option.setAttribute('data-name', textoValidar);
            
            selectTipoDoc.appendChild(option);
        });
    } catch (error) {
        console.error(error);
        toastr.error('No se pudieron cargar los tipos de documento');
    }
}

// ==========================================
// CARGA DE PERSONAS
// ==========================================
async function cargarPersonas(page = 1, pageSize = 10, search = '') {
    const tbody = document.querySelector('.tabla-datos tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;"><div class="loading">Cargando personas...</div></td></tr>';

    try {
        let url = `${API_URL_GET_ALL}?pageNumber=${page}&pageSize=${pageSize}`;
        if (search) url += `&searchTerm=${encodeURIComponent(search)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const data = await response.json();
        const items = data.items || [];
        personasCache = items;
        
        currentPage = data.pageNumber || page;
        totalCount = data.totalCount || 0;
        totalPages = data.totalPages || 1;
        hasNextPage = data.hasNextPage;
        hasPreviousPage = data.hasPreviousPage;

        renderizarTabla(items);
        actualizarPaginacion();

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#dc3545; font-weight:bold;">Error al cargar datos: ${error.message}</td></tr>`;
        toastr.error("No se pudieron cargar las personas");
    }
}

function renderizarTabla(items) {
    const tbody = document.querySelector('.tabla-datos tbody');
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666;">No se encontraron registros</td></tr>';
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="tipo-doc-badge">${item.documentType || 'DOC'}</span>
                ${item.documentNumber || '-'}
            </td>
            <td>${item.name || ''}</td>
            <td>${item.email || '-'}</td>
            <td>${item.phone || '-'}</td>
            <td>
                <div class="acciones">
                    <button class="btn-action btn-edit" onclick="abrirEditar('${item.id}')" title="Editar">✏️</button>
                    <button class="btn-action btn-delete" onclick="eliminarPersona('${item.id}')" title="Eliminar">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// VALIDACIONES (MODIFICADA)
// ==========================================
function validarReglasDocumento() {
    const select = document.getElementById('tipoDocumento');
    const input = document.getElementById('numeroDocumento');
    const errorSpan = document.getElementById('errorNumeroDocumento');
    
    const selectedOption = select.options[select.selectedIndex];
    const tipoNombre = selectedOption ? (selectedOption.getAttribute('data-name') || '') : '';
    const valor = input.value.trim();

    input.classList.remove('error');
    errorSpan.classList.remove('show');
    errorSpan.textContent = ''; 

    if (!valor) {
        input.classList.add('error');
        errorSpan.textContent = 'Requerido';
        errorSpan.classList.add('show');
        return false;
    }

    // APLICAR REGLAS ESTRICTAS SOLO PARA DNI Y RUC
    if (tipoNombre.includes('DNI') || tipoNombre.includes('RUC')) {
        if (!/^\d+$/.test(valor)) {
            input.classList.add('error');
            errorSpan.textContent = 'Solo números';
            errorSpan.classList.add('show');
            return false;
        }

        if (tipoNombre.includes('DNI') && valor.length !== 8) {
            input.classList.add('error');
            errorSpan.textContent = `Debe tener 8 dígitos`;
            errorSpan.classList.add('show');
            return false;
        } 
        else if (tipoNombre.includes('RUC') && valor.length !== 11) {
            input.classList.add('error');
            errorSpan.textContent = `Debe tener 11 dígitos`;
            errorSpan.classList.add('show');
            return false;
        }
    }
    // Si es "Documento Tributario" u otro, pasa la validación (el maxlength 25 lo limita el input)

    return true;
}

// Eventos validación
selectTipoDoc.addEventListener('change', () => {
    inputNumDoc.value = '';
    inputNumDoc.classList.remove('error');
    document.getElementById('errorNumeroDocumento').classList.remove('show');
    inputNumDoc.focus();
});

inputNumDoc.addEventListener('input', (e) => {
    // CAMBIO: Obtener tipo para decidir si limpiar caracteres no numéricos
    const selectedOption = selectTipoDoc.options[selectTipoDoc.selectedIndex];
    const tipoNombre = selectedOption ? (selectedOption.getAttribute('data-name') || '') : '';

    if (tipoNombre.includes('DNI') || tipoNombre.includes('RUC')) {
        e.target.value = e.target.value.replace(/\D/g, '');
    }
    
    validarReglasDocumento();
});

// ==========================================
// OPERACIONES CRUD
// ==========================================
function abrirModal() {
    modal.showModal();
    modalAbierto = true;
    if(selectTipoDoc.options.length <= 1) cargarTiposDocumento();
}

function cerrarModal() {
    modal.close();
    form.reset();
    limpiarErrores();
    modalAbierto = false;
    isEditMode = false;
    editingId = null;
    modalTitle.textContent = 'Nueva Persona';
    btnGuardar.textContent = 'Guardar';
}

document.getElementById('btnNuevaPersona').addEventListener('click', () => {
    isEditMode = false;
    abrirModal();
});

window.abrirEditar = function(id) {
    const item = personasCache.find(p => p.id === id);
    if (!item) return;

    isEditMode = true;
    editingId = id;
    modalTitle.textContent = 'Editar Persona';
    btnGuardar.textContent = 'Actualizar';

    if(selectTipoDoc.options.length <= 1) {
        cargarTiposDocumento().then(() => setFormValues(item));
    } else {
        setFormValues(item);
    }
    abrirModal();
};

function setFormValues(item) {
    selectTipoDoc.value = item.documentTypeId;
    inputNumDoc.value = item.documentNumber || '';
    document.getElementById('nombre').value = item.name || '';
    document.getElementById('email').value = item.email || '';
    document.getElementById('telefono').value = item.phone || '';
    document.getElementById('direccion').value = item.address || '';
}

// --- GUARDAR PERSONA (CON TOAST ARREGLADO) ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validarFormularioBasico()) return;
    if (!validarReglasDocumento()) return; 

    const payload = {
        documentTypeId: selectTipoDoc.value,
        documentNumber: inputNumDoc.value,
        name: document.getElementById('nombre').value.trim(),
        email: document.getElementById('email').value.trim() || null,
        phone: document.getElementById('telefono').value.trim() || null,
        address: document.getElementById('direccion').value.trim() || null
    };

    if (isEditMode) payload.id = editingId;

    let url = isEditMode ? `${API_URL_UPDATE}/${editingId}` : API_URL_CREATE;
    let method = isEditMode ? 'PUT' : 'POST';

    try {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Procesando...';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let data;
        try { 
            const textResponse = await response.text();
            data = JSON.parse(textResponse); 
        } catch(e) { data = null; }

        if (response.ok) {
            toastr.success(isEditMode ? 'Actualizado correctamente' : 'Creado correctamente');
            setTimeout(() => {
                cerrarModal();
                cargarPersonas(currentPage, currentPageSize, searchTerm);
            }, 1000);
        } else {
            // MANEJO DE ERRORES MÚLTIPLES
            if (data && data.errors && Array.isArray(data.errors)) {
                data.errors.forEach(err => toastr.error(err));
            } else if (data && data.message) {
                toastr.error(data.message);
            } else {
                let msg = `Error desconocido (${response.status})`;
                if (response.status === 404) msg = "Error 404: Servicio no encontrado";
                toastr.error(msg);
            }
        }
    } catch (error) {
        toastr.error('Error de conexión con el servidor');
        console.error(error);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = isEditMode ? 'Actualizar' : 'Guardar';
    }
});

// Eliminar
window.eliminarPersona = async function(id) {
    if (!confirm('¿Estás seguro de eliminar esta persona?')) return;
    try {
        const response = await fetch(`${API_URL_UPDATE}/${id}`, { method: 'DELETE' });
        
        // Intentar leer respuesta (a veces el error viene en JSON)
        let data = null;
        try { data = await response.json(); } catch(e){}

        if (response.ok) {
            toastr.success('Eliminado correctamente');
            cargarPersonas(currentPage, currentPageSize, searchTerm);
        } else {
            if(data && data.message) toastr.error(data.message);
            else if(data && data.errors && Array.isArray(data.errors)) data.errors.forEach(e => toastr.error(e));
            else toastr.error('No se pudo eliminar el registro');
        }
    } catch (error) { 
        toastr.error('Error de conexión'); 
    }
};

// ==========================================
// PAGINACIÓN Y UTILIDADES
// ==========================================
function actualizarPaginacion() {
    const rangeStart = totalCount === 0 ? 0 : ((currentPage - 1) * currentPageSize) + 1;
    const rangeEnd = Math.min(currentPage * currentPageSize, totalCount);
    
    document.getElementById('rangeStart').textContent = rangeStart;
    document.getElementById('rangeEnd').textContent = rangeEnd;
    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('currentPageDisplay').textContent = currentPage;
    document.getElementById('totalPagesDisplay').textContent = totalPages;
    
    document.getElementById('btnFirst').disabled = !hasPreviousPage;
    document.getElementById('btnPrev').disabled = !hasPreviousPage;
    document.getElementById('btnNext').disabled = !hasNextPage;
    document.getElementById('btnLast').disabled = !hasNextPage;
}

document.getElementById('btnFirst').addEventListener('click', () => { if (currentPage > 1) cargarPersonas(1, currentPageSize, searchTerm); });
document.getElementById('btnPrev').addEventListener('click', () => { if (hasPreviousPage) cargarPersonas(currentPage - 1, currentPageSize, searchTerm); });
document.getElementById('btnNext').addEventListener('click', () => { if (hasNextPage) cargarPersonas(currentPage + 1, currentPageSize, searchTerm); });
document.getElementById('btnLast').addEventListener('click', () => { if (currentPage < totalPages) cargarPersonas(totalPages, currentPageSize, searchTerm); });
document.getElementById('pageSize').addEventListener('change', (e) => {
    currentPageSize = parseInt(e.target.value);
    cargarPersonas(1, currentPageSize, searchTerm);
});

function validarFormularioBasico() {
    limpiarErrores();
    let isValid = true;
    ['tipoDocumento', 'nombre'].forEach(id => {
        const el = document.getElementById(id);
        if (!el.value.trim()) {
            el.classList.add('error');
            const errDiv = document.getElementById('error' + id.charAt(0).toUpperCase() + id.slice(1));
            if(errDiv) errDiv.classList.add('show');
            isValid = false;
        }
    });
    return isValid;
}

function limpiarErrores() {
    document.querySelectorAll('.error').forEach(e => e.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach(e => e.classList.remove('show'));
}

['nombre'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
        this.classList.remove('error');
        const errDiv = document.getElementById('error' + this.id.charAt(0).toUpperCase() + this.id.slice(1));
        if(errDiv) errDiv.classList.remove('show');
    });
});

document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value;
    document.getElementById('clearSearch').classList.toggle('visible', val.length > 0);
    debounceTimer = setTimeout(() => { searchTerm = val; cargarPersonas(1, currentPageSize, searchTerm); }, 500);
});
document.getElementById('clearSearch').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    searchTerm = '';
    cargarPersonas(1, currentPageSize, '');
    document.getElementById('clearSearch').classList.remove('visible');
});

document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
document.getElementById('btnCancelar').addEventListener('click', cerrarModal);

document.addEventListener('DOMContentLoaded', () => {
    cargarPersonas();
    cargarTiposDocumento();
});