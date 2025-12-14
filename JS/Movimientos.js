const API_BASE = "https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api";

const EP_MOVEMENTS = `${API_BASE}/InventoryMovement`;
const EP_WAREHOUSE = `${API_BASE}/Warehouse/select`;

let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let searchTerm = "";
let warehouseId = "";

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
        fetchMovimientos(currentPage); 
    });

    // BUSCADOR: Solo ENTER o CLICK en Lupa
    $('#searchInput').on('keypress', function(e) {
        if(e.which === 13) { // Enter
            searchTerm = $(this).val().trim();
            currentPage = 1;
            fetchMovimientos(currentPage);
        }
    });

    $('#btnSearch').on('click', function() {
        searchTerm = $('#searchInput').val().trim();
        currentPage = 1;
        fetchMovimientos(currentPage);
    });

    // Selector de Almacén
    $('#warehouseSelect').on('change', function() { 
        warehouseId = $(this).val(); 
        currentPage = 1; 
        fetchMovimientos(currentPage); 
    });
});

// FUNCIONES DE FORMATO
function formatearFechaPeru(fechaISO) {
    if (!fechaISO) return '-';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-PE', { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit', // SEGUNDOS INCLUIDOS
        hour12: false 
    });
}

function formatearNumero(num) {
    if (num == null) return "0.00";
    return parseFloat(num).toFixed(2);
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
            fetchMovimientos(currentPage);
        } else {
            toastr.warning("No hay almacenes registrados");
        }
    } catch (e) { 
        console.error(e);
        $('#movimientosBody').html(`<tr><td colspan="8" class="text-center" style="padding: 30px; color: #dc3545; font-weight: bold;">Error al cargar almacenes: ${e.message}</td></tr>`);
        toastr.error("Error de conexión al cargar almacenes");
    }
}

// 2. CARGAR MOVIMIENTOS (TABLA)
async function fetchMovimientos(page) {
    const $tbody = $('#movimientosBody'); 
    $tbody.html('<tr><td colspan="8" class="text-center" style="padding: 20px;">Cargando movimientos...</td></tr>');
    
    try {
        if(!warehouseId) throw new Error("No se ha seleccionado un almacén");

        // Construcción URL
        const url = `${EP_MOVEMENTS}?pageNumber=${page}&pageSize=${pageSize}&searchTerm=${searchTerm}&warehouseId=${warehouseId}`;
        const response = await fetch(url); 
        
        if (!response.ok) throw new Error("Error en la respuesta del servidor");

        const data = await response.json();
        $tbody.empty(); 
        const items = data.items || [];
        
        if (items.length === 0) { 
            $tbody.html('<tr><td colspan="8" class="text-center" style="padding: 20px;">No se encontraron movimientos.</td></tr>'); 
            return; 
        }
        
        items.forEach((mov) => {
            const fecha = formatearFechaPeru(mov.createdDate);
            const cantidad = parseFloat(mov.quantity) || 0;
            
            // Lógica de Colores: Negativo = Rojo, Positivo = Verde
            let colorClass = cantidad >= 0 ? 'text-success' : 'text-danger';
            let signo = cantidad > 0 ? '+' : ''; 

            const row = `<tr>
                <td>${fecha}</td>
                <td style="color: #6b7280;">${mov.warehouse || '-'}</td>
                <td><span style="background:#f3f4f6; padding:2px 6px; border-radius:4px; font-weight:600; font-size:12px;">${mov.productCode || '-'}</span></td>
                <td><div style="font-weight: 600; color: #111827;">${mov.productName || '-'}</div></td>
                <td><span class="badge-tipo">${mov.movementType || '-'}</span></td>
                
                <td class="text-center">
                    <span class="${colorClass}" style="font-weight: 700;">${signo}${formatearNumero(cantidad)}</span>
                </td>
                
                <td class="text-right" style="color: #6b7280;">${formatearNumero(mov.previousStock)}</td>
                <td class="text-right" style="font-weight: 700; color: #111827;">${formatearNumero(mov.newStock)}</td>
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
        console.error("Error fetchMovimientos:", error);
        $tbody.html(`<tr><td colspan="8" class="text-center" style="padding: 30px; color: #dc3545; font-weight: bold;">Error al cargar datos: ${error.message}</td></tr>`);
        toastr.error("No se pudieron cargar los movimientos.");
    }
}

function cambiarPagina(delta) { 
    const p = currentPage + delta; 
    if (p >= 1 && p <= totalPages) fetchMovimientos(p); 
}

function irAPagina(p) { 
    if (p >= 1 && p <= totalPages) fetchMovimientos(p); 
}