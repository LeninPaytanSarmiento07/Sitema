// Variable para saber si el modal está abierto
let modalAbierto = false;

// Configuración de Toastr para fuera del modal
toastr.options = {
    "closeButton": true,
    "debug": false,
    "newestOnTop": false,
    "progressBar": true,
    "positionClass": "toast-bottom-right",
    "preventDuplicates": true,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "4000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
};

// Función para mostrar toastr en el modal
function mostrarToastrModal(tipo, mensaje, titulo) {
    const container = document.getElementById('toast-container-modal');
    
    // Usar la configuración de Toastr pero redirigir al contenedor del modal
    const oldContainer = toastr.options.positionClass;
    toastr.options.target = '#toast-container-modal';
    
    toastr[tipo](mensaje, titulo);
    
    // Restaurar configuración
    toastr.options.target = null;
}

// Variables globales para la paginación y la búsqueda
let currentPage = 1;
let currentPageSize = 25;
let totalPages = 1;
let totalCount = 0;
let hasPreviousPage = false;
let hasNextPage = false;
let searchTerm = '';
let debounceTimer = null;
let isEditMode = false;
let editingProductId = null;
let productosCache = [];

const BASE_URL = 'https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api';
const API_URL = `${BASE_URL}/Product`;
const API_URL_CATEGORY = `${BASE_URL}/Category`; // Endpoint Categoría

const modal = document.getElementById('modalProducto');
const btnNuevoProducto = document.getElementById('btnNuevoProducto');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');
const btnGuardar = document.getElementById('btnGuardar');
const formProducto = document.getElementById('formProducto');
const modalTitle = document.getElementById('modalTitle');

// ===============================================
// PREVENIR CIERRE CON ESCAPE O CLIC FUERA
// ===============================================
// El evento 'cancel' se dispara al presionar ESC en un <dialog>
modal.addEventListener('cancel', (e) => {
    e.preventDefault(); // Evita que se cierre
});

// Función para limpiar errores de validación
function limpiarErrores() {
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
    document.getElementById('containerPrecioCompra').classList.remove('error');
    document.getElementById('containerPrecioVenta').classList.remove('error');
}

// Función para mostrar error en un campo
function mostrarError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    
    field.classList.add('error');
    
    // Manejar el caso especial de input-with-prefix
    if (field.parentElement && field.parentElement.classList.contains('input-with-prefix')) {
        field.parentElement.classList.add('error');
    }
    
    if (error) {
        error.classList.add('show');
    }
}

// Función para validar el formulario
function validarFormulario() {
    limpiarErrores();
    let isValid = true;
    
    const codigo = document.getElementById('codigo').value.trim();
    if (!codigo) {
        mostrarError('codigo', 'errorCodigo');
        isValid = false;
    }
    
    const nombre = document.getElementById('nombre').value.trim();
    if (!nombre) {
        mostrarError('nombre', 'errorNombre');
        isValid = false;
    }
    
    const unidadMedida = document.getElementById('unidadMedida').value;
    if (!unidadMedida) {
        mostrarError('unidadMedida', 'errorUnidadMedida');
        isValid = false;
    }
    
    const tipoIGV = document.getElementById('tipoIGV').value;
    if (!tipoIGV) {
        mostrarError('tipoIGV', 'errorTipoIGV');
        isValid = false;
    }
    
    const categoria = document.getElementById('categoria').value;
    if (!categoria) {
        mostrarError('categoria', 'errorCategoria');
        isValid = false;
    }
    
    const precioCompraInput = document.getElementById('precioCompra');
    const precioCompra = parseFloat(precioCompraInput.value);
    if (isNaN(precioCompra) || precioCompra < 0) {
        mostrarError('precioCompra', 'errorPrecioCompra');
        document.getElementById('containerPrecioCompra').classList.add('error');
        isValid = false;
    }
    
    const precioVentaInput = document.getElementById('precioVenta');
    const precioVenta = parseFloat(precioVentaInput.value);
    if (isNaN(precioVenta) || precioVenta <= 0) {
        mostrarError('precioVenta', 'errorPrecioVenta');
        document.getElementById('containerPrecioVenta').classList.add('error');
        isValid = false;
    }
    
    if (!isValid) {
        mostrarToastrModal('error', 'Por favor, complete todos los campos requeridos correctamente', 'Formulario incompleto');
    }
    
    return isValid;
}

// Eventos para limpiar errores al modificar campos
document.getElementById('codigo').addEventListener('input', limpiarErroresCampo);
document.getElementById('nombre').addEventListener('input', limpiarErroresCampo);
document.getElementById('unidadMedida').addEventListener('change', limpiarErroresCampo);
document.getElementById('tipoIGV').addEventListener('change', limpiarErroresCampo);
document.getElementById('categoria').addEventListener('change', limpiarErroresCampo);
document.getElementById('precioCompra').addEventListener('input', limpiarErroresCampo);
document.getElementById('precioVenta').addEventListener('input', limpiarErroresCampo);

function limpiarErroresCampo(event) {
    const fieldId = event.target.id;
    const errorId = 'error' + fieldId.charAt(0).toUpperCase() + fieldId.slice(1);
    
    event.target.classList.remove('error');
    if (document.getElementById(errorId)) {
        document.getElementById(errorId).classList.remove('show');
    }
    
    if (fieldId === 'precioCompra') {
        document.getElementById('containerPrecioCompra').classList.remove('error');
    } else if (fieldId === 'precioVenta') {
        document.getElementById('containerPrecioVenta').classList.remove('error');
    }
}


// Función para cargar las Unidades de Medida
async function cargarUnidadesMedida() {
    try {
        const response = await fetch(`${BASE_URL}/UnitOfMeasure`);
        if (!response.ok) throw new Error('Error al cargar unidades de medida');
        
        const data = await response.json();
        const select = document.getElementById('unidadMedida');
        
        select.innerHTML = '<option value="">Seleccionar...</option>';
        
        data.forEach(unidad => {
            const option = document.createElement('option');
            option.value = unidad.id;
            option.textContent = unidad.description;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error cargando unidades de medida:', error);
        mostrarToastrModal('error', 'No se pudieron cargar las unidades de medida', 'Error de carga');
    }
}

// Función para cargar los Tipos de IGV
async function cargarTiposIGV() {
    try {
        const response = await fetch(`${BASE_URL}/IGVType`);
        if (!response.ok) throw new Error('Error al cargar tipos de IGV');
        
        const data = await response.json();
        const select = document.getElementById('tipoIGV');
        
        select.innerHTML = '<option value="">Seleccionar...</option>';
        
        data.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.id;
            option.textContent = tipo.description;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error cargando tipos de IGV:', error);
        mostrarToastrModal('error', 'No se pudieron cargar los tipos de IGV', 'Error de carga');
    }
}

// Función para cargar las Categorías
async function cargarCategorias(selectIdToSet = null) {
    try {
        const response = await fetch(`${BASE_URL}/Category`);
        if (!response.ok) throw new Error('Error al cargar categorías');
        
        const data = await response.json();
        const select = document.getElementById('categoria');
        
        // Guardar valor seleccionado actual si existe, o usar el que pasamos por parámetro
        const currentValue = selectIdToSet || select.value;
        
        select.innerHTML = '<option value="">Seleccionar...</option>';
        
        data.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.description || categoria.name; 
            select.appendChild(option);
        });
        
        // Restaurar valor seleccionado
        if (currentValue) {
            select.value = currentValue;
        }
        
    } catch (error) {
        console.error('Error cargando categorías:', error);
        mostrarToastrModal('error', 'No se pudieron cargar las categorías', 'Error de carga');
    }
}

// Función para cargar datos de un producto desde el cache
function cargarDatosProducto(productId) {
    try {
        const producto = productosCache.find(p => p.id === productId);
        
        if (!producto) {
            throw new Error('Producto no encontrado en cache');
        }
        
        document.getElementById('codigo').value = producto.code || '';
        document.getElementById('nombre').value = producto.name || '';
        document.getElementById('descripcion').value = producto.description || '';
        
        setTimeout(() => {
            document.getElementById('unidadMedida').value = producto.unitOfMeasureId || '';
            document.getElementById('tipoIGV').value = producto.igvTypeId || '';
            document.getElementById('categoria').value = producto.categoryId || '';
        }, 100);
        
        document.getElementById('precioCompra').value = producto.purchasePrice || 0;
        document.getElementById('precioVenta').value = producto.salePrice || 0;
        
    } catch (error) {
        console.error('Error cargando datos del producto:', error);
        mostrarToastrModal('error', 'No se pudieron cargar los datos del producto', 'Error');
    }
}

// Abrir modal para NUEVO producto
btnNuevoProducto.addEventListener('click', async () => {
    modalAbierto = true;
    isEditMode = false;
    editingProductId = null;
    modalTitle.textContent = 'Nuevo Producto';
    btnGuardar.textContent = 'Guardar';
    formProducto.reset();
    limpiarErrores();
    
    document.getElementById('precioCompra').value = 0; 
    
    modal.showModal();
    
    await Promise.all([
        cargarUnidadesMedida(),
        cargarTiposIGV(),
        cargarCategorias()
    ]);
});

// Función para abrir modal en modo EDICIÓN
async function abrirModalEdicion(productId) {
    try {
        modalAbierto = true;
        isEditMode = true;
        editingProductId = productId;
        modalTitle.textContent = 'Editar Producto';
        btnGuardar.textContent = 'Actualizar';
        limpiarErrores();
        
        modal.showModal();
        
        await Promise.all([
            cargarUnidadesMedida(),
            cargarTiposIGV(),
            cargarCategorias()
        ]);
        
        cargarDatosProducto(productId);
        
    } catch (error) {
        console.error('Error al abrir modal de edición:', error);
        mostrarToastrModal('error', 'No se pudo abrir el formulario de edición', 'Error');
        modal.close();
        modalAbierto = false;
    }
}

// Limpiar toasts del modal
function limpiarToastsModal() {
    const container = document.getElementById('toast-container-modal');
    container.innerHTML = '';
}

// Funciones para cerrar modal
function cerrarModal() {
    modal.close();
    formProducto.reset();
    limpiarErrores();
    limpiarToastsModal();
    isEditMode = false;
    editingProductId = null;
    modalAbierto = false;
}

// Cerrar modal con botón X
btnCerrarModal.addEventListener('click', cerrarModal);

// Cerrar modal con botón Cancelar
btnCancelar.addEventListener('click', cerrarModal);

// ELIMINADO: Evento click outside para cerrar modal. Ahora es modal nativo y no se cierra solo.

// Manejar envío del formulario (POST o PUT)
formProducto.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
        return;
    }
    
    btnGuardar.disabled = true;
    btnGuardar.textContent = isEditMode ? 'Actualizando...' : 'Guardando...';
    
    const formData = new FormData(formProducto);
    
    const producto = {
        unitOfMeasureId: formData.get('unidadMedida'),
        igvTypeId: formData.get('tipoIGV'),
        categoryId: formData.get('categoria'),
        code: formData.get('codigo').trim(),
        name: formData.get('nombre').trim(),
        description: formData.get('descripcion').trim() || '',
        purchasePrice: parseFloat(formData.get('precioCompra')),
        salePrice: parseFloat(formData.get('precioVenta'))
    };
    
    try {
        let response;
        let finalUrl = API_URL;
        let method = 'POST';
        
        if (isEditMode) {
            finalUrl = `${API_URL}/${editingProductId}`;
            method = 'PUT';
        }

        response = await fetch(finalUrl, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(producto)
        });
        
        if (response.ok) {
            if (isEditMode) {
                mostrarToastrModal('success', 'El producto ha sido actualizado correctamente', 'Producto actualizado');
            } else {
                mostrarToastrModal('success', 'El producto ha sido creado correctamente', 'Producto creado');
            }
            
            setTimeout(() => {
                cerrarModal();
                cargarProductosVentas1(currentPage, currentPageSize, searchTerm);
            }, 1500);
            
        } else {
            const errorData = await response.json();
            let errorMessage = 'Ocurrió un error desconocido';
            
            if (errorData.errors && Array.isArray(errorData.errors)) {
                errorMessage = errorData.errors.join('<br>');
            } else if (errorData.message) {
                errorMessage = errorData.message;
            }
            
            mostrarToastrModal('error', errorMessage, isEditMode ? 'Error al actualizar' : 'Error al crear');
        }
        
    } catch (error) {
        mostrarToastrModal('error', 'Error de conexión con el servidor', 'Error de conexión');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = isEditMode ? 'Actualizar' : 'Guardar';
    }
});


// ==========================================
// NUEVA LOGICA: MODAL CATEGORIA
// ==========================================
const modalCat = document.getElementById('modalNuevaCategoria');

// BLOQUEAR CIERRE CON ESC PARA EL MODAL CATEGORÍA
modalCat.addEventListener('cancel', (e) => {
    e.preventDefault();
});

function abrirModalNuevaCategoria() {
    // Usar showModal() del elemento dialog (se apila automáticamente)
    modalCat.showModal();
    
    document.getElementById('formNuevaCategoria').reset();
    document.getElementById('cat_nombre').classList.remove('error');
    document.getElementById('error_cat_nombre').classList.remove('show');
}

function cerrarModalNuevaCategoria() {
    modalCat.close();
}

async function guardarNuevaCategoria() {
    const nombreInput = document.getElementById('cat_nombre');
    const descInput = document.getElementById('cat_descripcion');
    const errorMsg = document.getElementById('error_cat_nombre');
    
    const nombre = nombreInput.value.trim();
    
    if (!nombre) {
        nombreInput.classList.add('error');
        errorMsg.classList.add('show');
        return;
    } else {
        nombreInput.classList.remove('error');
        errorMsg.classList.remove('show');
    }

    const payload = {
        name: nombre,
        description: descInput.value.trim() || null
    };

    try {
        const response = await fetch(API_URL_CATEGORY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            mostrarToastrModal('success', 'Categoría creada correctamente', 'Éxito');
            cerrarModalNuevaCategoria();
            cargarCategorias(); // Recargar el select del modal principal
        } else {
            const errorData = await response.json();
            let msg = 'Error al crear categoría';
            if (errorData.errors && Array.isArray(errorData.errors)) msg = errorData.errors[0];
            else if (errorData.message) msg = errorData.message;
            
            mostrarToastrModal('error', msg, 'Error');
        }
    } catch (error) {
        console.error(error);
        mostrarToastrModal('error', 'Error de conexión', 'Error');
    }
}


// Función de debounce
function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

// Función principal para cargar productos
async function cargarProductosVentas1(pageNumber = 1, pageSize = 25, search = '') {
    const tbody = document.querySelector('.tabla-productos tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;"><div class="loading">Cargando productos...</div></td></tr>`;

    try {
        let url = `${API_URL}?pageNumber=${pageNumber}&pageSize=${pageSize}`;
        if (search && search.trim() !== '') {
            url += `&searchTerm=${encodeURIComponent(search.trim())}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        const productos = data.items || [];
        
        productosCache = productos; 
        currentPage = data.pageNumber || pageNumber;
        currentPageSize = data.pageSize || pageSize;
        totalCount = data.totalCount || 0;
        totalPages = data.totalPages || 1;
        hasPreviousPage = data.hasPreviousPage || false;
        hasNextPage = data.hasNextPage || false;
        
        if (productos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #666;">No se encontraron productos</td></tr>`;
            actualizarPaginacion();
            return;
        }

        tbody.innerHTML = '';

        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="codigo">${producto.code || 'N/A'}</td>
                <td>${producto.name || 'Sin nombre'}</td>
                <td>${producto.unitOfMeasure || 'N/A'}</td>
                <td>${producto.igvType || 'N/A'}</td>
                <td><span class="categoria">${producto.category || 'Sin categoría'}</span></td>
                <td class="precio">S/ ${(producto.purchasePrice || 0).toFixed(2)}</td>
                <td class="precio">S/ ${(producto.salePrice || 0).toFixed(2)}</td>
                <td>
                    <div class="acciones">
                        <button class="btn btn-edit" data-id="${producto.id}" title="Editar Producto">✏️</button>
                        <button class="btn btn-delete" data-id="${producto.id}" title="Eliminar Producto">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-id');
                abrirModalEdicion(productId);
            });
        });
        
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-id');
                if (confirm(`¿Está seguro que desea eliminar el producto?`)) {
                    eliminarProducto(productId);
                }
            });
        });

        actualizarPaginacion();
        
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #dc3545;">Error al cargar productos</td></tr>`;
        toastr.error('No se pudieron cargar los productos', 'Error');
        totalCount = 0; currentPage = 0; totalPages = 0;
        actualizarPaginacion();
    }
}

// Función para eliminar un producto
async function eliminarProducto(productId) {
    try {
        const response = await fetch(`${API_URL}/${productId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            toastr.success('El producto ha sido eliminado correctamente', 'Eliminación exitosa');
            cargarProductosVentas1(currentPage, currentPageSize, searchTerm);
        } else {
            const errorData = await response.json();
            const errorMessage = errorData.message || 'Error desconocido al eliminar';
            toastr.error(errorMessage, 'Error al eliminar');
        }
    } catch (error) {
        toastr.error('Error de conexión con el servidor', 'Error de conexión');
    }
}

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

// Configuración de la búsqueda
const realizarBusqueda = debounce((searchValue) => {
    searchTerm = searchValue;
    cargarProductosVentas1(1, currentPageSize, searchTerm);
}, 500);

const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');

searchInput.addEventListener('input', (e) => {
    const value = e.target.value;
    if (value.trim() !== '') {
        clearSearchBtn.classList.add('visible');
    } else {
        clearSearchBtn.classList.remove('visible');
    }
    realizarBusqueda(value);
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.remove('visible');
    searchTerm = '';
    cargarProductosVentas1(1, currentPageSize, '');
    searchInput.focus();
});

document.getElementById('btnFirst').addEventListener('click', () => { if (currentPage > 1) cargarProductosVentas1(1, currentPageSize, searchTerm); });
document.getElementById('btnPrev').addEventListener('click', () => { if (hasPreviousPage) cargarProductosVentas1(currentPage - 1, currentPageSize, searchTerm); });
document.getElementById('btnNext').addEventListener('click', () => { if (hasNextPage) cargarProductosVentas1(currentPage + 1, currentPageSize, searchTerm); });
document.getElementById('btnLast').addEventListener('click', () => { if (currentPage < totalPages) cargarProductosVentas1(totalPages, currentPageSize, searchTerm); });
document.getElementById('pageSize').addEventListener('change', (e) => { currentPageSize = parseInt(e.target.value); cargarProductosVentas1(1, currentPageSize, searchTerm); });

// Inicializar
cargarProductosVentas1(1, 5, '');