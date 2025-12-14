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

const modal = document.getElementById('modalProducto');
const btnNuevoProducto = document.getElementById('btnNuevoProducto');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');
const btnGuardar = document.getElementById('btnGuardar');
const formProducto = document.getElementById('formProducto');
const modalTitle = document.getElementById('modalTitle');

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
        
        console.log('✓ Unidades de medida cargadas:', data.length);
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
        
        console.log('✓ Tipos de IGV cargados:', data.length);
    } catch (error) {
        console.error('Error cargando tipos de IGV:', error);
        mostrarToastrModal('error', 'No se pudieron cargar los tipos de IGV', 'Error de carga');
    }
}

// Función para cargar las Categorías
async function cargarCategorias() {
    try {
        const response = await fetch(`${BASE_URL}/Category`);
        if (!response.ok) throw new Error('Error al cargar categorías');
        
        const data = await response.json();
        const select = document.getElementById('categoria');
        
        select.innerHTML = '<option value="">Seleccionar...</option>';
        
        data.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.description || categoria.name; // Usar description o name
            select.appendChild(option);
        });
        
        console.log('✓ Categorías cargadas:', data.length);
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
        
        console.log('Producto encontrado en cache:', producto);
        
        document.getElementById('codigo').value = producto.code || '';
        document.getElementById('nombre').value = producto.name || '';
        document.getElementById('descripcion').value = producto.description || '';
        
        // Usar setTimeout para asegurar que los selects estén poblados antes de intentar setear el valor
        setTimeout(() => {
            document.getElementById('unidadMedida').value = producto.unitOfMeasureId || '';
            document.getElementById('tipoIGV').value = producto.igvTypeId || '';
            document.getElementById('categoria').value = producto.categoryId || '';
        }, 100);
        
        document.getElementById('precioCompra').value = producto.purchasePrice || 0;
        document.getElementById('precioVenta').value = producto.salePrice || 0;
        
        console.log('✓ Datos del producto cargados correctamente');
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
    
    document.getElementById('precioCompra').value = 0; // Asegurar 0 en compra
    
    modal.showModal();
    
    // Cargar listas de opciones en paralelo
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
        
        // Cargar listas de opciones en paralelo
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

// Cerrar modal al hacer clic fuera (solo si es <dialog>)
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        cerrarModal();
    }
});

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
            console.log('Actualizando producto:', editingProductId, producto);
        } else {
            console.log('Creando producto:', producto);
        }

        response = await fetch(finalUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
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
                // Recargar productos manteniendo la página y búsqueda actual
                cargarProductosVentas1(currentPage, currentPageSize, searchTerm);
            }, 1500);
            
        } else {
            const errorData = await response.json();
            console.error('Error del servidor:', errorData);
            
            let errorMessage = 'Ocurrió un error desconocido';
            
            if (errorData.errors && Array.isArray(errorData.errors)) {
                errorMessage = errorData.errors.join('<br>');
            } else if (errorData.errors && typeof errorData.errors === 'object') {
                const messages = [];
                Object.values(errorData.errors).forEach(errorArray => {
                    if (Array.isArray(errorArray)) {
                        messages.push(...errorArray);
                    }
                });
                errorMessage = messages.join('<br>');
            } else if (errorData.message) {
                errorMessage = errorData.message;
            } else if (typeof errorData === 'string') {
                errorMessage = errorData;
            }
            
            mostrarToastrModal('error', errorMessage, isEditMode ? 'Error al actualizar' : 'Error al crear');
        }
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToastrModal('error', 'Error de conexión con el servidor', 'Error de conexión');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = isEditMode ? 'Actualizar' : 'Guardar';
    }
});

// Función de debounce
function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

// Función principal para cargar productos
async function cargarProductosVentas1(pageNumber = 1, pageSize = 25, search = '') {
    console.log(`Cargando página ${pageNumber} con ${pageSize} elementos, búsqueda: "${search}"`);
    
    const tbody = document.querySelector('.tabla-productos tbody');
    if (!tbody) {
        console.error('No se encontró la tabla');
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 40px;">
                <div class="loading">Cargando productos...</div>
            </td>
        </tr>
    `;

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
        
        productosCache = productos; // Almacenar en caché para edición
        
        // Actualizar variables de paginación
        currentPage = data.pageNumber || pageNumber;
        currentPageSize = data.pageSize || pageSize;
        totalCount = data.totalCount || 0;
        totalPages = data.totalPages || 1;
        hasPreviousPage = data.hasPreviousPage || false;
        hasNextPage = data.hasNextPage || false;
        
        console.log('Datos recibidos:', { 
            productos: productos.length, 
            totalCount, 
            totalPages, 
            currentPage,
        });
        
        if (productos.length === 0) {
            const mensaje = search && search.trim() !== '' 
                ? `No se encontraron productos que coincidan con "${search}"`
                : 'No hay productos disponibles';
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                        ${mensaje}
                    </td>
                </tr>
            `;
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
        
        // Asignar eventos de edición
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-id');
                abrirModalEdicion(productId);
            });
        });
        
        // Asignar eventos de eliminación (Implementación básica de eliminación)
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-id');
                if (confirm(`¿Está seguro que desea eliminar el producto con ID: ${productId}?`)) {
                    eliminarProducto(productId);
                }
            });
        });

        actualizarPaginacion();
        console.log('✓ Tabla renderizada correctamente');
        
    } catch (error) {
        console.error('Error al cargar productos:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #dc3545;">
                    Error al cargar productos: ${error.message}. Verifique la URL de la API.
                </td>
            </tr>
        `;
        toastr.error('No se pudieron cargar los productos', 'Error de carga');
        // Asegurar que la paginación muestre 0 si hay un error
        totalCount = 0;
        currentPage = 0;
        totalPages = 0;
        actualizarPaginacion();
    }
}

// Función para eliminar un producto
async function eliminarProducto(productId) {
    try {
        const response = await fetch(`${API_URL}/${productId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            toastr.success('El producto ha sido eliminado correctamente', 'Eliminación exitosa');
            // Recargar datos, volviendo a la página 1 si la página actual queda vacía
            cargarProductosVentas1(currentPage, currentPageSize, searchTerm);
        } else {
            const errorData = await response.json();
            const errorMessage = errorData.message || 'Error desconocido al eliminar';
            toastr.error(errorMessage, 'Error al eliminar');
            console.error('Error al eliminar:', errorData);
        }
    } catch (error) {
        console.error('Error de conexión al eliminar:', error);
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
}, 500); // Debounce de 500ms

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

// Controles de Paginación
document.getElementById('btnFirst').addEventListener('click', () => {
    if (currentPage > 1) cargarProductosVentas1(1, currentPageSize, searchTerm);
});

document.getElementById('btnPrev').addEventListener('click', () => {
    if (hasPreviousPage) cargarProductosVentas1(currentPage - 1, currentPageSize, searchTerm);
});

document.getElementById('btnNext').addEventListener('click', () => {
    if (hasNextPage) cargarProductosVentas1(currentPage + 1, currentPageSize, searchTerm);
});

document.getElementById('btnLast').addEventListener('click', () => {
    if (currentPage < totalPages) cargarProductosVentas1(totalPages, currentPageSize, searchTerm);
});

document.getElementById('pageSize').addEventListener('change', (e) => {
    currentPageSize = parseInt(e.target.value);
    cargarProductosVentas1(1, currentPageSize, searchTerm); // Volver a la página 1 al cambiar el tamaño
});

// Inicializar la carga de productos al cargar la página
cargarProductosVentas1(1, 5, '');