// ==========================================
// CONFIGURACIÓN INICIAL
// ==========================================
const BASE_URL = 'https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api';
const API_URL = `${BASE_URL}/Warehouse`;

let modalAbierto = false;
let isEditMode = false;
let editingId = null;

// Variables de datos
let almacenesCache = [];
let searchTerm = '';
let debounceTimer = null;

// Elementos del DOM
const modal = document.getElementById('modalAlmacen');
const form = document.getElementById('formAlmacen');
const modalTitle = document.getElementById('modalTitle');
const btnGuardar = document.getElementById('btnGuardar');

// Configuración Toastr
toastr.options = {
    "closeButton": true,
    "progressBar": true,
    "positionClass": "toast-bottom-right",
    "timeOut": "3000"
};

function mostrarToastrModal(tipo, mensaje, titulo) {
    const originalTarget = toastr.options.target;
    toastr.options.target = '#toast-container-modal';
    toastr[tipo](mensaje, titulo);
    toastr.options.target = originalTarget;
}

// ==========================================
// CARGA DE DATOS (GET)
// ==========================================
async function cargarAlmacenes(search = '') {
    const tbody = document.querySelector('.tabla-datos tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;"><div class="loading">Cargando almacenes...</div></td></tr>';

    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // Manejo flexible de respuesta
        let items = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data.items && Array.isArray(data.items)) {
            items = data.items;
        }
        
        almacenesCache = items;

        // Filtro local
        if (search) {
            const term = search.toLowerCase();
            items = items.filter(item => 
                (item.name && item.name.toLowerCase().includes(term)) || 
                (item.address && item.address.toLowerCase().includes(term))
            );
        }

        renderizarTabla(items);

    } catch (error) {
        console.error('Error al cargar:', error);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">Error al cargar datos: ${error.message}</td></tr>`;
        toastr.error('No se pudieron cargar los almacenes');
    }
}

function renderizarTabla(items) {
    const tbody = document.querySelector('.tabla-datos tbody');
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#666;">No se encontraron registros</td></tr>';
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name || 'Sin Nombre'}</td>
            <td>${item.address || '<span style="color:#999; font-style:italic;">Sin dirección</span>'}</td>
            <td>
                <div class="acciones">
                    <button class="btn-action btn-edit" onclick="abrirEditar('${item.id}')" title="Editar">✏️</button>
                    <button class="btn-action btn-delete" onclick="eliminarAlmacen('${item.id}')" title="Eliminar">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// OPERACIONES CRUD (POST / PUT / DELETE)
// ==========================================
function abrirModal() {
    modal.showModal();
    modalAbierto = true;
}

function cerrarModal() {
    modal.close();
    form.reset();
    limpiarErrores();
    modalAbierto = false;
    isEditMode = false;
    editingId = null;
    modalTitle.textContent = 'Nuevo Almacén';
    btnGuardar.textContent = 'Guardar';
}

// Nuevo
document.getElementById('btnNuevoAlmacen').addEventListener('click', () => {
    isEditMode = false;
    abrirModal();
});

// Editar
window.abrirEditar = function(id) {
    const item = almacenesCache.find(i => i.id === id);
    if (!item) return;

    isEditMode = true;
    editingId = id;
    modalTitle.textContent = 'Editar Almacén';
    btnGuardar.textContent = 'Actualizar';

    document.getElementById('nombre').value = item.name;
    document.getElementById('direccion').value = item.address || '';
    
    abrirModal();
};

// Guardar
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    const payload = {
        name: document.getElementById('nombre').value.trim(),
        address: document.getElementById('direccion').value.trim() || null
    };

    if (isEditMode) {
        payload.id = editingId;
    }

    const url = isEditMode ? `${API_URL}/${editingId}` : API_URL;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Procesando...';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            mostrarToastrModal('success', isEditMode ? 'Almacén actualizado' : 'Almacén creado', 'Éxito');
            setTimeout(() => {
                cerrarModal();
                cargarAlmacenes(searchTerm);
            }, 1000);
        } else {
            // ============================================================
            // CAPTURA DE ERROR ESPECÍFICO (IGUAL QUE EN CATEGORÍAS)
            // ============================================================
            const errorData = await response.json();
            let errorMessage = 'Error desconocido al guardar';

            // 1. Caso array: {"errors": ["El nombre ya existe"]}
            if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                errorMessage = errorData.errors[0]; 
            } 
            // 2. Caso mensaje directo
            else if (errorData.message) {
                errorMessage = errorData.message;
            }

            mostrarToastrModal('error', errorMessage, 'Error');
        }

    } catch (error) {
        mostrarToastrModal('error', 'Error de conexión con el servidor', 'Error');
        console.error(error);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = isEditMode ? 'Actualizar' : 'Guardar';
    }
});

// Eliminar
window.eliminarAlmacen = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este almacén?')) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        
        if (response.ok) {
            toastr.success('Almacén eliminado correctamente');
            cargarAlmacenes(searchTerm);
        } else {
            toastr.error('No se pudo eliminar el registro');
        }
    } catch (error) {
        toastr.error('Error de conexión');
    }
};

// ==========================================
// UTILIDADES
// ==========================================
function validarFormulario() {
    limpiarErrores();
    const nombre = document.getElementById('nombre');
    let isValid = true;

    if (!nombre.value.trim()) {
        nombre.classList.add('error');
        document.getElementById('errorNombre').classList.add('show');
        isValid = false;
    }
    return isValid;
}

function limpiarErrores() {
    document.querySelectorAll('.error').forEach(e => e.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach(e => e.classList.remove('show'));
}

document.getElementById('nombre').addEventListener('input', limpiarErrores);

// Búsqueda
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value;
    document.getElementById('clearSearch').classList.toggle('visible', val.length > 0);
    
    debounceTimer = setTimeout(() => {
        searchTerm = val;
        cargarAlmacenes(searchTerm);
    }, 300);
});

document.getElementById('clearSearch').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    searchTerm = '';
    cargarAlmacenes('');
    document.getElementById('clearSearch').classList.remove('visible');
});

document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
document.getElementById('btnCancelar').addEventListener('click', cerrarModal);

// INICIO
document.addEventListener('DOMContentLoaded', () => {
    cargarAlmacenes();
});