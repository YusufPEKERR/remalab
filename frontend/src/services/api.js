// QWebChannel is loaded globally via script tag in index.html

let backendPromise = null;

const getMockBackend = () => ({
    login: (username, password, cb) => {
        setTimeout(() => {
            if (username === 'admin' && password === 'admin') {
                cb(JSON.stringify({ success: true, user: { username: 'admin', role: 'admin' } }));
            } else {
                cb(JSON.stringify({ success: false, message: 'Invalid credentials (Mock)' }));
            }
        }, 500);
    },
    get_users: (cb) => {
        setTimeout(() => {
            cb(JSON.stringify({ success: true, users: [
                { id: 1, username: 'admin', email: 'admin@test.com', role: 'Admin' }
            ]}));
        }, 500);
    },
    create_user: (username, email, password, role, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true })), 500);
    },
    update_user: (id, username, email, password, role, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true })), 500);
    },
    delete_user: (id, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true })), 500);
    },
    get_parts: (cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true, parts: [] })), 500);
    },
    create_part: (...args) => {
        const cb = args[args.length - 1];
        setTimeout(() => cb(JSON.stringify({ success: true })), 500);
    },
    update_part: (...args) => {
        const cb = args[args.length - 1];
        setTimeout(() => cb(JSON.stringify({ success: true })), 500);
    },
    delete_part: (id, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true })), 500);
    },
    get_dev_mode: (cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true, dev_mode: true })), 200);
    },
    set_dev_mode: (enabled, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true })), 200);
    }
});

export const getBackend = () => {
    if (!backendPromise) {
        backendPromise = new Promise((resolve, reject) => {
            if (typeof window.qt === 'undefined' || !window.qt.webChannelTransport) {
                console.warn('Qt WebChannel not detected. Connecting over WebSocket...');
                const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
                const wsUri = wsProtocol + window.location.host + '/ws';
                const socket = new WebSocket(wsUri);

                socket.onopen = () => {
                    console.log('WebSocket connected. Initializing QWebChannel...');
                    new QWebChannel(socket, (channel) => {
                        console.log('QWebChannel initialized over WebSocket!');
                        if (channel.objects.backend) {
                            resolve(channel.objects.backend);
                        } else {
                            reject(new Error('Backend object not registered on WebSocket QWebChannel'));
                        }
                    });
                };

                socket.onerror = (err) => {
                    console.error('WebSocket connection error, using mock:', err);
                    resolve(getMockBackend());
                };
                return;
            }

            // Initialize QWebChannel
            new QWebChannel(window.qt.webChannelTransport, (channel) => {
                if (channel.objects.backend) {
                    resolve(channel.objects.backend);
                } else {
                    reject(new Error('Backend object not registered on QWebChannel'));
                }
            });
        });
    }
    return backendPromise;
};

// API Wrapper Functions (Promisified)
export const api = {
    login: async (username, password) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.login(username, password, (res) => resolve(JSON.parse(res)));
        });
    },
    
    getUsers: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_users((res) => resolve(JSON.parse(res)));
        });
    },

    createUser: async (userData) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.create_user(
                userData.username,
                userData.tc_no || '',
                userData.password,
                userData.role,
                userData.gorev || '',
                userData.fullname || '',
                userData.account_enabled !== undefined ? userData.account_enabled : true,
                userData.team_leader || '',
                userData.operation_manager || '',
                userData.administrative_manager || '',
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    updateUser: async (id, userData) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_user(
                String(id),
                userData.username,
                userData.tc_no || '',
                userData.password || '',
                userData.role,
                userData.gorev || '',
                userData.fullname || '',
                userData.account_enabled !== undefined ? userData.account_enabled : true,
                userData.team_leader || '',
                userData.operation_manager || '',
                userData.administrative_manager || '',
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    deleteUser: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.delete_user(String(id), (res) => resolve(JSON.parse(res)));
        });
    },

    // ==========================
    // PARTS (PARÇALAR) MODÜLÜ
    // ==========================

    getParts: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_parts(async (resStr) => {
                try {
                    const res = JSON.parse(resStr);
                    if (res.fetch_url) {
                        const fetchRes = await fetch(res.fetch_url, { cache: 'no-store' });
                        const jsonData = await fetchRes.json();
                        resolve(jsonData);
                    } else {
                        resolve(res);
                    }
                } catch (e) {
                    resolve({ success: false, message: e.message });
                }
            });
        });
    },

    getItemModel: async (itemCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_item_model) {
                backend.get_item_model(itemCode || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, model: '' });
            }
        });
    },

    getItemCodesByModel: async (modelName) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_item_codes_by_model) {
                backend.get_item_codes_by_model(modelName || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, item_codes: [] });
            }
        });
    },

    getItemCodes: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (!backend.get_item_codes) {
                resolve({ success: false, item_codes: [] });
                return;
            }
            backend.get_item_codes(async (resStr) => {
                try {
                    const res = JSON.parse(resStr);
                    if (res.fetch_url) {
                        const fetchRes = await fetch(res.fetch_url, { cache: 'no-store' });
                        const jsonData = await fetchRes.json();
                        resolve(jsonData);
                    } else {
                        resolve(res);
                    }
                } catch (e) {
                    resolve({ success: false, item_codes: [], message: e.message });
                }
            });
        });
    },

    createPart: async (partData) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.create_part(
                partData.name || '',
                partData.item_code || '',
                partData.barcode || '',
                partData.brand || '',
                partData.model || '',
                partData.item_category || '',
                partData.part_category || '',
                partData.part_category_id ? String(partData.part_category_id) : '',
                partData.stock_tracking_type || 'Stok Takipli',
                Array.isArray(partData.department) ? partData.department.join(', ') : (partData.department || ''),
                partData.status || 'Aktif',
                partData.critical_limit !== undefined ? String(partData.critical_limit) : '',
                partData.memory || '',
                partData.part_type || '',
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    updatePart: async (id, partData) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_part(
                String(id),
                partData.name || '',
                partData.item_code || '',
                partData.barcode || '',
                partData.brand || '',
                partData.model || '',
                partData.item_category || '',
                partData.part_category || '',
                partData.part_category_id ? String(partData.part_category_id) : '',
                partData.stock_tracking_type || 'Stok Takipli',
                Array.isArray(partData.department) ? partData.department.join(', ') : (partData.department || ''),
                partData.status || 'Aktif',
                partData.critical_limit !== undefined ? String(partData.critical_limit) : '',
                partData.memory || '',
                partData.part_type || '',
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    deletePart: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.delete_part(String(id), (res) => resolve(JSON.parse(res)));
        });
    },

    deletePartsBulk: async (ids) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.delete_parts_bulk(ids.join(','), (res) => resolve(JSON.parse(res)));
        });
    },


    // ==========================
    // LOCATIONS (LOKASYONLAR)
    // ==========================

    getLocations: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_locations) {
                backend.get_locations((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, locations: [{id: 1, name: "Raf A1 (Mock)"}]});
            }
        });
    },

    createLocation: async (name, description = "") => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_location) {
                backend.create_location(name, description, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    deleteLocation: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_location) {
                backend.delete_location(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    getSystemLocations: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_system_locations) {
                backend.get_system_locations((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, locations: [] });
            }
        });
    },

    // ==========================
    // DEPARTMANLAR
    // ===================
    getDepartments: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_departments) {
                backend.get_departments((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, departments: [] });
            }
        });
    },

    getProductFamilies: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_product_families) {
                backend.get_product_families((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, product_families: [] });
            }
        });
    },

    // ==========================
    // PARÇA KATEGORİLERİ
    // ==========================

    getPartCategories: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_part_categories) {
                backend.get_part_categories((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ 
                    success: true, 
                    categories: [
                        {id: 1, name: "Ekran / LCD"}, 
                        {id: 2, name: "Batarya"}, 
                        {id: 3, name: "Kasa / Back Cover"}, 
                        {id: 4, name: "Ön Cam / Front Glass"},
                        {id: 5, name: "Arka Cam / Back Glass"},
                        {id: 6, name: "Anakart / Mainboard"}, 
                        {id: 7, name: "Ön Kamera / Front Camera"}, 
                        {id: 8, name: "Arka Kamera / Main Camera"}, 
                        {id: 9, name: "Şarj Soketi / Charging Connector"},
                        {id: 10, name: "Ahize / Receiver"},
                        {id: 11, name: "Hoparlör / Speaker"},
                        {id: 12, name: "Mikrofon / Microphone"},
                        {id: 13, name: "NFC"},
                        {id: 14, name: "Titreşim / Vibration Engine"},
                        {id: 15, name: "Sensör / Sensor FPC"}
                    ] 
                });
            }
        });
    },

    createDepartment: async (dept) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_department) {
                backend.create_department(
                    dept.name || '',
                    dept.code || '',
                    dept.responsible || '',
                    dept.default_location_id ? String(dept.default_location_id) : '',
                    dept.status || 'Aktif',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    createPartCategory: async (cat) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_part_category) {
                backend.create_part_category(
                    cat.name || '',
                    cat.part_type || '',
                    cat.flow || '',
                    Array.isArray(cat.departments) ? cat.departments.join(', ') : (cat.departments || ''),
                    cat.stock_tracking_type || 'Stok Takipli',
                    cat.default_location_id ? String(cat.default_location_id) : '',
                    cat.description || '',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    updatePartCategory: async (id, cat) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_part_category) {
                backend.update_part_category(
                    String(id),
                    cat.name || '',
                    cat.part_type || '',
                    cat.flow || '',
                    Array.isArray(cat.departments) ? cat.departments.join(', ') : (cat.departments || ''),
                    cat.stock_tracking_type || 'Stok Takipli',
                    cat.default_location_id ? String(cat.default_location_id) : '',
                    cat.is_active === false ? 'false' : 'true',
                    cat.description || '',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    updateDepartment: async (id, dept) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_department) {
                backend.update_department(
                    String(id),
                    dept.name || '',
                    dept.code || '',
                    dept.responsible || '',
                    dept.default_location_id ? String(dept.default_location_id) : '',
                    dept.status || 'Aktif',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    deleteDepartment: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_department) {
                backend.delete_department(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // SERVİS KAYITLARI
    // ==========================

    getServiceRecords: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_service_records) {
                backend.get_service_records((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, records: [] });
            }
        });
    },

    createServiceRecord: async (rec) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_service_record) {
                backend.create_service_record(
                    rec.customer_name || '',
                    rec.customer_phone || '',
                    rec.customer_email || '',
                    rec.company || '',
                    rec.brand || '',
                    rec.model || '',
                    rec.memory || '',
                    rec.product_code || '',
                    rec.color || '',
                    rec.fault_category || '',
                    rec.fault_type || '',
                    rec.customer_complaint || '',
                    rec.preliminary_diagnosis || '',
                    rec.status || 'Arıza Kabul',
                    rec.technician_note || '',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    updateServiceRecord: async (id, rec) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_service_record) {
                backend.update_service_record(
                    String(id),
                    rec.customer_name || '',
                    rec.customer_phone || '',
                    rec.customer_email || '',
                    rec.company || '',
                    rec.brand || '',
                    rec.model || '',
                    rec.memory || '',
                    rec.product_code || '',
                    rec.color || '',
                    rec.fault_category || '',
                    rec.fault_type || '',
                    rec.customer_complaint || '',
                    rec.preliminary_diagnosis || '',
                    rec.status || 'Arıza Kabul',
                    rec.technician_note || '',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    deleteServiceRecord: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_service_record) {
                backend.delete_service_record(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // İŞ EMİRLERİ
    // ==========================

    getWorkOrders: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_work_orders) {
                backend.get_work_orders((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, work_orders: [] });
            }
        });
    },

    createWorkOrder: async (order) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_work_order) {
                backend.create_work_order(
                    order.service_record_id || '',
                    order.description || '',
                    order.assigned_technician || '',
                    order.priority || 'Orta',
                    order.start_date || '',
                    order.end_date || '',
                    order.parts_used || '[]',
                    order.status || 'Beklemede',
                    order.source_location_id || '',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true, id: null });
            }
        });
    },

    updateWorkOrder: async (id, order) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_work_order) {
                backend.update_work_order(
                    String(id),
                    order.service_record_id || '',
                    order.description || '',
                    order.assigned_technician || '',
                    order.priority || 'Orta',
                    order.start_date || '',
                    order.end_date || '',
                    order.parts_used || '[]',
                    order.status || 'Beklemede',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    deleteWorkOrder: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_work_order) {
                backend.delete_work_order(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // PRODUCTION WORK ORDER (Yarı Mamul Üretim İş Emri)
    // ==========================

    createProductionWorkOrder: async (order) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_production_work_order) {
                backend.create_production_work_order(
                    order.target_part_id || '',
                    order.description || '',
                    order.priority || 'Orta',
                    order.planned_quantity != null ? String(order.planned_quantity) : '',
                    order.assigned_technician || '',
                    order.department || '',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true, id: null });
            }
        });
    },

    startProductionWorkOrder: async (workOrderId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.start_production_work_order) {
                backend.start_production_work_order(
                    String(workOrderId),
                    username || '',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    completeProductionWorkOrder: async (workOrderId, producedQuantity, scrapQuantity, productionNotes, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.complete_production_work_order) {
                backend.complete_production_work_order(
                    String(workOrderId),
                    String(producedQuantity),
                    String(scrapQuantity),
                    productionNotes || '',
                    username || '',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    getMaterialRequests: async (workOrderId) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_material_requests) {
                backend.get_material_requests(String(workOrderId), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, material_requests: [] });
            }
        });
    },

    issueMaterialRequest: async (mrId, quantity, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.issue_material_request) {
                backend.issue_material_request(String(mrId), String(quantity), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    reportMaterialFire: async (mrId, fireQty, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.report_material_fire) {
                backend.report_material_fire(String(mrId), String(fireQty), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    returnBomPartToDoa: async (partId, returnQty, sourceLocationId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.return_bom_part_to_doa) {
                backend.return_bom_part_to_doa(String(partId), String(returnQty), String(sourceLocationId), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    issueExtraBomMaterials: async (partId, extraQty, sourceLocationId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.issue_extra_bom_materials) {
                backend.issue_extra_bom_materials(String(partId), String(extraQty), String(sourceLocationId || ''), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    receiveExtraBomMaterials: async (partId, extraQty, targetLocationId, technician) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.receive_extra_bom_materials) {
                backend.receive_extra_bom_materials(String(partId), String(extraQty), String(targetLocationId), technician || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // PARÇA TEDARİK DURUMU (İş Emri Parça Satırları)
    // ==========================

    getWorkOrderPartsByImei: async (imei) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_work_order_parts_by_imei(String(imei), (res) => {
                resolve(JSON.parse(res));
            });
        });
    },

    getWorkOrderParts: async (workOrderId) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_work_order_parts) {
                backend.get_work_order_parts(String(workOrderId), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, parts: [] });
            }
        });
    },

    addWorkOrderPartsBulk: async (workOrderId, rows, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.add_work_order_parts_bulk) {
                backend.add_work_order_parts_bulk(String(workOrderId), JSON.stringify(rows || []), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, inserted: 0 });
            }
        });
    },

        addMaterialRequest: async (workOrderId, partId, quantity, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.add_material_request) {
                backend.add_material_request(String(workOrderId), String(partId), String(quantity), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: 'Backend method not found.' });
            }
        });
    },
    addWorkOrderPart: async (workOrderId, partId, quantity, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.add_work_order_part) {
                backend.add_work_order_part(String(workOrderId), String(partId), String(quantity), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, part: null });
            }
        });
    },

    deliverWorkOrderPart: async (wopId, locationId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.deliver_work_order_part) {
                backend.deliver_work_order_part(String(wopId), String(locationId), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    markWorkOrderPartWaiting: async (wopId, notes, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.mark_work_order_part_waiting) {
                backend.mark_work_order_part_waiting(String(wopId), notes || '', username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    removeWorkOrderPart: async (wopId, reason) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.remove_work_order_part) {
                // Try sending it as a single JSON string!
                backend.remove_work_order_part(JSON.stringify({id: wopId, reason: reason || ''}), (res) => {
                    try { resolve(JSON.parse(res)); } catch(e) { resolve({success: false, message: 'Parse error'}); }
                });
            } else {
                resolve({ success: true });
            }
        });
    },

    revertWorkOrderPartStatus: async (wopId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.revert_work_order_part_status) {
                backend.revert_work_order_part_status(String(wopId), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    returnPartToDoa: async (wopId, returnQty, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.return_part_to_doa) {
                backend.return_part_to_doa(String(wopId), String(returnQty), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    removeWorkOrderPart: async (wopId, reason) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.remove_work_order_part) {
                // Try sending it as a single JSON string!
                backend.remove_work_order_part(JSON.stringify({id: wopId, reason: reason || ''}), (res) => {
                    try { resolve(JSON.parse(res)); } catch(e) { resolve({success: false, message: 'Parse error'}); }
                });
            } else {
                resolve({ success: true });
            }
        });
    },

    createSupplyRequest: async (workOrderId, partId, quantity, notes, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_supply_request) {
                backend.create_supply_request(String(workOrderId), String(partId), String(quantity), notes || '', username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    getSupplyRequests: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_supply_requests) {
                backend.get_supply_requests((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, requests: [] });
            }
        });
    },

    getSupplyRequestHistory: async (username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_supply_request_history) {
                backend.get_supply_request_history(username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, requests: [] });
            }
        });
    },

    cancelSupplyRequest: async (wopId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.cancel_supply_request) {
                backend.cancel_supply_request(String(wopId), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // ÜRETİM (Yarı Mamul / Malzeme Tüketimi / Geçmiş)
    // ==========================

    getProductionRuns: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_production_runs) {
                backend.get_production_runs((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, production_runs: [] });
            }
        });
    },

    createProductionRun: async (run) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_production_run) {
                backend.create_production_run(
                    run.target_part_id || '',
                    String(run.quantity_produced || ''),
                    run.source_location_id || '',
                    run.target_location_id || '',
                    run.produced_by || '',
                    run.notes || '',
                    run.materials_json || '[]',
                    run.department || '',
                    String(run.scrap_quantity || '0'),
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    deleteProductionRun: async (id, returnLocationId = "", returnReason = "", defectivePartsJson = "[]", replacementPartsJson = "[]") => {
        const backend = await getBackend();
        return new Promise((resolve, reject) => {
            if (backend.delete_production_run) {
                const paramsJson = JSON.stringify({
                    unit_id: String(id),
                    return_location_id: String(returnLocationId || ""),
                    return_reason: returnReason || "",
                    defective_parts: JSON.parse(defectivePartsJson || "[]"),
                    replacement_parts: JSON.parse(replacementPartsJson || "[]")
                });
                backend.delete_production_run(paramsJson, (res) => {
                    try {
                        resolve(JSON.parse(res));
                    } catch(e) {
                        reject(new Error("Backend yanıt parse hatası: " + res));
                    }
                });
            } else {
                resolve({ success: true });
            }
        });
    },

    deletePartCategory: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_part_category) {
                backend.delete_part_category(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // PRODUCTS (Ürün Listesi / Telefon)
    // ==========================

    getProducts: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_products) {
                backend.get_products(async (resStr) => {
                    try {
                        const res = JSON.parse(resStr);
                        if (res.fetch_url) {
                            const fetchRes = await fetch(res.fetch_url, { cache: 'no-store' });
                            const jsonData = await fetchRes.json();
                            resolve(jsonData);
                        } else {
                            resolve(res);
                        }
                    } catch (e) {
                        resolve({ success: false, message: e.message });
                    }
                });
            } else {
                resolve({ success: true, products: [] });
            }
        });
    },

    createProduct: async (p) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_product) {
                backend.create_product(p.item_code || '', p.brand || '', p.model || '', p.memory || '', p.color || '', p.name || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    updateProduct: async (id, p) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_product) {
                backend.update_product(String(id), p.item_code || '', p.brand || '', p.model || '', p.memory || '', p.color || '', p.name || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    deleteProduct: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_product) {
                backend.delete_product(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // MÜŞTERİLER
    // ==========================

    getCustomers: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_customers) {
                backend.get_customers((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, customers: [] });
            }
        });
    },

    createCustomer: async (c) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_customer) {
                backend.create_customer(
                    c.customer_name || '', c.customer_phone || '', c.customer_email || '', c.company || '',
                    c.imei_number || '', c.serial_number || '', c.internal_id || '', c.cihaz_modeli || '',
                    c.flow || '', c.customer_reported_complaint || '', c.intake_date || '',
                    c.code || '', c.short_name || '', c.currency || '', c.customer_language || '',
                    c.use_mio ? 'true' : 'false',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    updateCustomer: async (id, c) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_customer) {
                backend.update_customer(
                    String(id),
                    c.customer_name || '', c.customer_phone || '', c.customer_email || '', c.company || '',
                    c.imei_number || '', c.serial_number || '', c.internal_id || '', c.cihaz_modeli || '',
                    c.flow || '', c.customer_reported_complaint || '', c.intake_date || '',
                    c.code || '', c.short_name || '', c.currency || '', c.customer_language || '',
                    c.use_mio ? 'true' : 'false',
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    deleteCustomer: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_customer) {
                backend.delete_customer(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    downloadCustomerBulkTemplate: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.generate_customer_bulk_template) {
                backend.generate_customer_bulk_template((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: 'Bu özellik mevcut değil.' });
            }
        });
    },

    bulkImportCustomers: async (rows) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.bulk_import_customers) {
                backend.bulk_import_customers(JSON.stringify(rows || []), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: 'Bu özellik mevcut değil.', errors: [] });
            }
        });
    },

    // ==========================
    // STOK & DEPO & İRSALİYE
    // ==========================

    getStockStatus: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_stock_status) {
                backend.get_stock_status(async (resStr) => {
                    try {
                        const res = JSON.parse(resStr);
                        if (res.fetch_url) {
                            const fetchRes = await fetch(res.fetch_url, { cache: 'no-store' });
                            const jsonData = await fetchRes.json();
                            resolve(jsonData);
                        } else {
                            resolve(res);
                        }
                    } catch (e) {
                        resolve({ success: false, message: e.message });
                    }
                });
            } else {
                resolve({ success: true, stock: [] });
            }
        });
    },

    getStockStatusPaged: async (search, page, pageSize) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_stock_status_paged) {
                backend.get_stock_status_paged(search || '', String(page || 1), String(pageSize || 30), (resStr) => {
                    try {
                        resolve(JSON.parse(resStr));
                    } catch (e) {
                        resolve({ success: false, message: e.message });
                    }
                });
            } else {
                resolve({ success: true, stock: [], total: 0, total_quantity: 0 });
            }
        });
    },

    transferStock: async (partId, fromLoc, toLoc, qty, user) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.transfer_stock) {
                backend.transfer_stock(String(partId), String(fromLoc), String(toLoc), String(qty), user, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    getStockMovements: async (typeStr) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_stock_movements) {
                backend.get_stock_movements(typeStr, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, movements: [] });
            }
        });
    },

    addInboundEntry: async (partId, locId, qty, price, typeStr, user) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.add_inbound_entry) {
                backend.add_inbound_entry(String(partId), String(locId), String(qty), String(price), typeStr, user, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    addOutboundEntry: async (partId, locId, qty, typeStr, user, technician, description) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.add_outbound_entry) {
                backend.add_outbound_entry(String(partId), String(locId), String(qty), typeStr, user, technician || "", description || "", (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    getReports: async (startDate, endDate) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_reports) {
                backend.get_reports(startDate || "", endDate || "", (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, reports: [] });
            }
        });
    },

    getDashboardStats: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_dashboard_stats) {
                backend.get_dashboard_stats((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, stats: { totalParts: 0, criticalStock: 0, todaysInbound: 0, todaysOutbound: 0, activeLocations: 0 } });
            }
        });
    },

    getCriticalStock: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_critical_stock) {
                backend.get_critical_stock(async (resStr) => {
                    try {
                        const res = JSON.parse(resStr);
                        if (res.fetch_url) {
                            const fetchRes = await fetch(res.fetch_url, { cache: 'no-store' });
                            const jsonData = await fetchRes.json();
                            resolve(jsonData);
                        } else {
                            resolve(res);
                        }
                    } catch (e) {
                        resolve({ success: false, message: e.message });
                    }
                });
            } else {
                resolve({ success: true, critical_stock: [] });
            }
        });
    },

    getHistoricalStock: async (targetDate) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_historical_stock) {
                backend.get_historical_stock(targetDate, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, historical_stock: [] });
            }
        });
    },

    exportTableToExcel: async (data, filename) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.export_table_to_excel) {
                backend.export_table_to_excel(JSON.stringify(data), filename, (res) => resolve(JSON.parse(res)));
            } else {
                console.warn("export_table_to_excel metodu bulunamadı, mock çalışıyor.");
                resolve({ success: true, file_path: `C:/mock/path/${filename}` });
            }
        });
    },

    // ==========================
    // ITEM BOM (ÜRÜN AĞACI)
    // ==========================
    getItemBOMs: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_item_boms) {
                backend.get_item_boms((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, item_boms: [] });
            }
        });
    },

    createItemBOM: async (data) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_item_bom) {
                backend.create_item_bom(JSON.stringify(data), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    updateItemBOM: async (id, data) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_item_bom) {
                backend.update_item_bom(String(id), JSON.stringify(data), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    deleteItemBOM: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_item_bom) {
                backend.delete_item_bom(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // PRODUCT BOM (ÜRÜN AĞACI - MODELE BAĞLI)
    // ==========================
    getProductBOMs: async (page = 1, pageSize = 50, searchTerm = '', modelFilter = '', statusFilter = '') => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_product_boms) {
                backend.get_product_boms(
                    String(page), 
                    String(pageSize), 
                    String(searchTerm || ''), 
                    String(modelFilter || ''), 
                    String(statusFilter || ''), 
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true, boms: [], total: 0 });
            }
        });
    },

    createProductBOM: async (product_model, child_item_code, quantity) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_product_bom) {
                backend.create_product_bom(
                    product_model, 
                    child_item_code, 
                    String(quantity || 1), 
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true });
            }
        });
    },

    updateProductBOM: async (id, product_model, child_item_code, quantity) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_product_bom) {
                backend.update_product_bom(
                    String(id),
                    product_model, 
                    child_item_code, 
                    String(quantity || 1), 
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    deleteProductBOM: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_product_bom) {
                backend.delete_product_bom(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    toggleProductBomStatus: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.toggle_product_bom_status) {
                backend.toggle_product_bom_status(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    // ==========================
    // BATCH ENTRY (BATCH GİRİŞİ)
    // ==========================
    getBatchEntries: async (page = 1, pageSize = 50, searchTerm = '', flowFilter = '') => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_batch_entries) {
                backend.get_batch_entries(
                    String(page),
                    String(pageSize),
                    String(searchTerm || ''),
                    String(flowFilter || ''),
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: true, records: [], total: 0 });
            }
        });
    },

    createBatchEntry: async (data) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_batch_entry) {
                backend.create_batch_entry(JSON.stringify(data), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    updateBatchEntry: async (id, data) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_batch_entry) {
                backend.update_batch_entry(String(id), JSON.stringify(data), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    deleteBatchEntry: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_batch_entry) {
                backend.delete_batch_entry(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    getBatchSummary: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_batch_summary) {
                backend.get_batch_summary((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, batches: [] });
            }
        });
    },

    clearAllBatchEntries: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.clear_all_batch_entries) {
                backend.clear_all_batch_entries((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    bulkDeleteBatchEntries: async (ids) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.bulk_delete_batch_entries) {
                backend.bulk_delete_batch_entries(JSON.stringify(ids), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    bulkUpdateBatchFlow: async (ids, newFlow) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.bulk_update_batch_flow) {
                backend.bulk_update_batch_flow(JSON.stringify(ids), String(newFlow), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    lookupBatchEntry: async (searchTerm) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.lookup_batch_entry) {
                backend.lookup_batch_entry(String(searchTerm), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, found: false });
            }
        });
    },

    exportAllTablesToExcel: async (filename) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.export_all_tables_to_excel) {
                backend.export_all_tables_to_excel(filename, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Excel export not available in mock mode" });
            }
        });
    },

    getDevMode: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_dev_mode((res) => resolve(JSON.parse(res)));
        });
    },

    setDevMode: async (enabled) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.set_dev_mode(enabled, (res) => resolve(JSON.parse(res)));
        });
    },

    updateDbSettings: async (settings) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_db_settings) {
                backend.update_db_settings(settings.host, settings.port, settings.dbName, settings.user, settings.password, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend bridge missing" });
            }
        });
    },

    // ==========================
    // LOCAL DB & DATA FOLDERS
    // ==========================
    getLocalFiles: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_local_files) {
                backend.get_local_files((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, local_files: [] });
            }
        });
    },
    addLocalFile: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.add_local_file) {
                backend.add_local_file((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend bridge missing" });
            }
        });
    },
    createLocalFile: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.create_local_file) {
                backend.create_local_file((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend bridge missing" });
            }
        });
    },
    deleteLocalFile: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_local_file) {
                backend.delete_local_file(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },
    openLocalFolder: async (path) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.open_local_folder) {
                backend.open_local_folder(path, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },
    getDataFolders: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_data_folders) {
                backend.get_data_folders((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, data_folders: [] });
            }
        });
    },
    addDataFolder: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.add_data_folder) {
                backend.add_data_folder((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend bridge missing" });
            }
        });
    },
    deleteDataFolder: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_data_folder) {
                backend.delete_data_folder(String(id), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true });
            }
        });
    },

    // ==========================
    // DYNAMIC TABLE MANAGEMENT
    // ==========================
    getAllTablesSchema: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_all_tables_schema) {
                backend.get_all_tables_schema((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend bridge missing" });
            }
        });
    },
    getTableData: async (schema, table) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_table_data) {
                backend.get_table_data(schema, table, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend bridge missing" });
            }
        });
    },
    insertTableData: async (schema, table, data) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.insert_table_data) {
                backend.insert_table_data(schema, table, JSON.stringify(data), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend bridge missing" });
            }
        });
    }
};
