const API_BASE = "https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api";

const EP_INVENTORY = `${API_BASE}/Inventory`;
const EP_WAREHOUSE = `${API_BASE}/Warehouse/select`;

let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let searchTerm = "";
let warehouseId = "";
let searchTimer = null; // Para el debounce del buscador

toastr.options = { 
    "closeButton": true, 
    "positionClass": "toast-bottom-right", 
    "timeOut": "5000",
    "preventDuplicates": false 
};

$(document).ready(function() {
    loadWarehouses();

    // Eventos Paginación
    $('#btnPrev').click(() => cambiarPagina(-1));
    $('#btnNext').click(() => cambiarPagina(1));
    $('#btnFirst').click(() => irAPagina(1));
    $('#btnLast').click(() => irAPagina(totalPages));
    
    // Selector de Tamaño de Página
    $('#pageSizeSelect').on('change', function() { 
        pageSize = parseInt($(this).val()); 
        currentPage = 1; 
        fetchInventario(currentPage); 
    });

    // BUSCADOR AUTOMÁTICO (DEBOUNCE)
    // Se ejecuta 300ms después de que el usuario deja de escribir
    $('#searchInput').on('input', function() {
        const val = $(this).val().trim();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { 
            searchTerm = val; 
            currentPage = 1; 
            fetchInventario(currentPage); 
        }, 300); 
    });

    // Selector de Almacén
    $('#warehouseSelect').on('change', function() { 
        warehouseId = $(this).val(); 
        currentPage = 1; 
        fetchInventario(currentPage); 
    });
});

function formatearNumero(num) {
    if (num == null) return "0.00";
    return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 1. CARGA INICIAL DE ALMACENES
async function loadWarehouses() {
    try {
        const r = await fetch(EP_WAREHOUSE);
        if(!r.ok) throw new Error("Error al cargar almacenes");
        
        const d = await r.json(); 
        const $s = $('#warehouseSelect'); $s.empty(); 
        
        if (d.length > 0) {
            d.forEach((w, i) => { 
                $s.append(`<option value="${w.id}">${w.name}</option>`); 
                if (i === 0) warehouseId = w.id; 
            });
            // Cargar inventario una vez tenemos el almacén por defecto
            fetchInventario(currentPage);
        } else {
            toastr.warning("No hay almacenes registrados");
        }
    } catch (e) { 
        console.error(e);
        $('#inventarioBody').html(`<tr><td colspan="8" class="text-center" style="padding: 30px; color: #dc3545; font-weight: bold;">Error al cargar almacenes: ${e.message}</td></tr>`);
        toastr.error("Error de conexión al cargar almacenes");
    }
}

// 2. CARGAR INVENTARIO (TABLA)
async function fetchInventario(page) {
    const $tbody = $('#inventarioBody'); 
    $tbody.html('<tr><td colspan="4" class="text-center" style="padding: 20px;">Cargando inventario...</td></tr>');
    
    try {
        if(!warehouseId) throw new Error("No se ha seleccionado un almacén");

        // Construcción URL
        const url = `${EP_INVENTORY}?pageNumber=${page}&pageSize=${pageSize}&searchTerm=${searchTerm}&warehouseId=${warehouseId}`;
        const response = await fetch(url); 
        
        if (!response.ok) throw new Error("Error en la respuesta del servidor");

        const data = await response.json();
        $tbody.empty(); 
        const items = data.items || [];
        
        if (items.length === 0) { 
            $tbody.html('<tr><td colspan="4" class="text-center" style="padding: 20px;">No se encontraron productos en este almacén.</td></tr>'); 
            return; 
        }
        
        items.forEach((item) => {
            const stock = parseFloat(item.stock) || 0;
            // Estilo para stock 0
            const stockClass = stock > 0 ? 'stock-val' : 'stock-zero';

            const row = `<tr>
                <td><span style="background:#f3f4f6; padding:2px 6px; border-radius:4px; font-weight:600; font-size:12px; color:#374151;">${item.productCode || '-'}</span></td>
                <td><div style="font-weight: 600; color: #111827;">${item.productName || '-'}</div></td>
                <td>${item.unitOfMeasure || '-'}</td>
                <td class="text-right">
                    <span class="${stockClass}">${formatearNumero(stock)}</span>
                </td>
            </tr>`;
            $tbody.append(row);
        });

        // Actualizar Paginación
        currentPage = data.pageNumber; 
        totalPages = data.totalPages;
        const totalCount = data.totalCount;

        $('#lblStart').text((currentPage - 1) * pageSize + 1); 
        $('#lblEnd').text(Math.min(currentPage * pageSize, totalCount)); 
        $('#lblTotal').text(totalCount); 
        $('#btnPageDisplay').text(`${currentPage} / ${totalPages}`);
        
        $('#btnPrev').prop('disabled', !data.hasPreviousPage); 
        $('#btnFirst').prop('disabled', !data.hasPreviousPage); 
        $('#btnNext').prop('disabled', !data.hasNextPage); 
        $('#btnLast').prop('disabled', !data.hasNextPage);

    } catch (error) { 
        console.error("Error fetchInventario:", error);
        $tbody.html(`<tr><td colspan="4" class="text-center" style="padding: 30px; color: #dc3545; font-weight: bold;">Error al cargar datos: ${error.message}</td></tr>`);
        toastr.error("No se pudo cargar el inventario.");
    }
}

function cambiarPagina(delta) { 
    const p = currentPage + delta; 
    if (p >= 1 && p <= totalPages) fetchInventario(p); 
}

function irAPagina(p) { 
    if (p >= 1 && p <= totalPages) fetchInventario(p); 
}