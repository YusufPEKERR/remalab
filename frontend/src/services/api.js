// QWebChannel is loaded globally via script tag in index.html

let backendPromise = null;

const getMockBackend = () => ({
    login: (username, password, cb) => {
        setTimeout(() => {
            cb(JSON.stringify({ 
                success: false, 
                message: 'Veritabanı / Sunucu bağlantısı kurulamadı. Lütfen sunucuyu ve veritabanı bağlantısını kontrol edin.' 
            }));
        }, 300);
    },
    get_users: (cb) => {
        setTimeout(() => {
            cb(JSON.stringify({
                success: false, 
                message: 'Veritabanı bağlantısı yok.'
            }));
        }, 300);
    },
    create_user: (username, email, password, role, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: false, message: 'Veritabanı bağlantısı yok.' })), 300);
    },
    update_user: (id, username, email, password, role, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: false, message: 'Veritabanı bağlantısı yok.' })), 300);
    },
    delete_user: (id, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: false, message: 'Veritabanı bağlantısı yok.' })), 300);
    },
    get_parts: (cb) => {
        setTimeout(() => cb(JSON.stringify({ success: false, parts: [], message: 'Veritabanı bağlantısı yok.' })), 300);
    },
    create_part: (...args) => {
        const cb = args[args.length - 1];
        setTimeout(() => cb(JSON.stringify({ success: false, message: 'Veritabanı bağlantısı yok.' })), 300);
    },
    update_part: (...args) => {
        const cb = args[args.length - 1];
        setTimeout(() => cb(JSON.stringify({ success: false, message: 'Veritabanı bağlantısı yok.' })), 300);
    },
    delete_part: (id, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: false, message: 'Veritabanı bağlantısı yok.' })), 300);
    },
    drop_schema_table: (tableName, confirmName, username, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: false, message: 'Veritabanı bağlantısı yok.' })), 300);
    },
    get_dev_mode: (cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true, dev_mode: false })), 200);
    },
    set_dev_mode: (enabled, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: false, message: 'Veritabanı bağlantısı yok.' })), 200);
    },
    get_delivered_parts_for_device: (imeiOrSerial, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true, parts: [] })), 200);
    },
    return_delivered_part: (repairRecordId, imeiOrSerial, targetStock, username, cb) => {
        setTimeout(() => cb(JSON.stringify({ success: true, message: 'Parça başarıyla geri alındı (Mock).' })), 200);
    }
});

export const getBackend = () => {
    if (!backendPromise) {
        backendPromise = new Promise((resolve) => {
            let isResolved = false;
            const safeResolve = (backendObj) => {
                if (!isResolved) {
                    isResolved = true;
                    resolve(backendObj);
                }
            };

            const getQWebChannelClass = () => {
                if (typeof window !== 'undefined' && window.QWebChannel) return window.QWebChannel;
                if (typeof QWebChannel !== 'undefined') return QWebChannel;
                return null;
            };

            if (typeof window.qt === 'undefined' || !window.qt.webChannelTransport) {
                console.warn('Qt WebChannel not detected in browser. Connecting over WebSocket (port 5174)...');
                const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
                const hostName = window.location.hostname || '127.0.0.1';
                const wsUri = `${wsProtocol}${hostName}:5174`;

                const timeoutId = setTimeout(() => {
                    console.warn('WebSocket connection timed out (3s). Falling back to mock backend.');
                    safeResolve(getMockBackend());
                }, 3000);

                try {
                    const socket = new WebSocket(wsUri);

                    socket.onopen = () => {
                        clearTimeout(timeoutId);
                        console.log('WebSocket connected. Initializing QWebChannel...');
                        const QWebChannelClass = getQWebChannelClass();
                        if (!QWebChannelClass) {
                            console.error('QWebChannel is not defined on window.');
                            safeResolve(getMockBackend());
                            return;
                        }
                        try {
                            new QWebChannelClass(socket, (channel) => {
                                if (channel && channel.objects && channel.objects.backend) {
                                    safeResolve(channel.objects.backend);
                                } else {
                                    safeResolve(getMockBackend());
                                }
                            });
                        } catch (err) {
                            console.error('Failed to create QWebChannel instance:', err);
                            safeResolve(getMockBackend());
                        }
                    };

                    socket.onerror = (err) => {
                        clearTimeout(timeoutId);
                        console.error('WebSocket connection failed:', err);
                        safeResolve(getMockBackend());
                    };

                    socket.onclose = () => {
                        clearTimeout(timeoutId);
                        if (!isResolved) {
                            console.warn('WebSocket closed before connection established.');
                            safeResolve(getMockBackend());
                        }
                    };
                } catch (e) {
                    clearTimeout(timeoutId);
                    console.error('WebSocket creation error:', e);
                    safeResolve(getMockBackend());
                }
                return;
            }

            // Initialize QWebChannel for Qt WebEngine
            try {
                const QWebChannelClass = getQWebChannelClass();
                if (!QWebChannelClass) {
                    safeResolve(getMockBackend());
                    return;
                }
                new QWebChannelClass(window.qt.webChannelTransport, (channel) => {
                    if (channel && channel.objects && channel.objects.backend) {
                        safeResolve(channel.objects.backend);
                    } else {
                        safeResolve(getMockBackend());
                    }
                });
            } catch (err) {
                console.error('Qt QWebChannel initialization failed:', err);
                safeResolve(getMockBackend());
            }
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

    getSchemaIntrospection: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_schema_introspection((res) => resolve(res));
        });
    },

    dropSchemaTable: async (tableName, confirmName, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.drop_schema_table(tableName, confirmName, username, (res) => resolve(JSON.parse(res)));
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

    getPartsForDevice: async (deviceModelText) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_parts_for_device(String(deviceModelText || ''), (res) => resolve(JSON.parse(res)));
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
    getPartsPaginated: async (page = 1, limit = 100, searchTerm = "", filterCategory = "", sortKey = "", sortDir = "") => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_parts_paginated) {
                backend.get_parts_paginated(page, limit, searchTerm, filterCategory, sortKey, sortDir, (res) => {
                    resolve(JSON.parse(res));
                });
            } else {
                resolve({ success: false, parts: [], total_count: 0 });
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

    bulkImportParts: async (rows) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.bulk_import_parts(JSON.stringify(rows || []), (res) => resolve(JSON.parse(res)));
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
                resolve({ success: true, locations: [{ id: 1, name: "Raf A1 (Mock)" }] });
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

    getMissionGroups: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_mission_groups) {
                backend.get_mission_groups((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, mission_groups: [] });
            }
        });
    },

    getMissionForItemCategory: async (itemCategory) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_mission_for_item_category(String(itemCategory || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getMissionsForItemCategory: async (itemCategory) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_missions_for_item_category(String(itemCategory || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getFlowValues: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_flow_values((res) => resolve(JSON.parse(res)));
        });
    },

    getApprovedCategoriesForFlow: async (flow) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_approved_categories_for_flow(String(flow || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    // ==========================
    // GÖREV YÖNETİMİ (Mission — Departman Yönetimi'nin gerçek kaynağı)
    // ==========================

    getMissions: async (departmentFilter) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_missions) {
                backend.get_missions(String(departmentFilter || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, missions: [] });
            }
        });
    },

    getMissionWorkgroups: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_mission_workgroups) {
                backend.get_mission_workgroups((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, mission_workgroups: [] });
            }
        });
    },

    getServiceStatuList: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_service_statu_list) {
                backend.get_service_statu_list((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, service_statu: [] });
            }
        });
    },

    getItemSupplyStatuses: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_item_supply_statuses) {
                backend.get_item_supply_statuses((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, supply_statuses: [] });
            }
        });
    },

    updateRepairSupplyStatus: async (repairId, supplyStatusCode, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.update_repair_supply_status) {
                backend.update_repair_supply_status(String(repairId), supplyStatusCode || '', username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    // Hızlı Onarım Bitiş: cihazı okut, o görev grubundaki uygun onarımları kapat.
    // Kısmi kapatma yapar - uygun olmayan kayıtlar açık kalır, sebebi results[] içinde döner.
    quickCompleteRepair: async (deviceRef, missionGroupCode, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.quick_complete_repair) {
                backend.quick_complete_repair(String(deviceRef || ''), String(missionGroupCode || ''), username || '', (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik (uygulamayı yeniden başlatın)" });
            }
        });
    },

    // Onarım Bitiş Testi: departmanda bitiş testi bekleyen (1006) kayıtları getirir.
    getCompletionTestPool: async (departmentCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_completion_test_pool) {
                backend.get_completion_test_pool(String(departmentCode || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, items: [], message: "Backend eksik (uygulamayı yeniden başlatın)" });
            }
        });
    },

    // Onarım Bitiş Testi kararı. result: 'pass' | 'fail'. Başarısızda açıklama zorunlu.
    submitCompletionTest: async (repairId, result, description, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.submit_completion_test) {
                backend.submit_completion_test(String(repairId || ''), String(result || ''), String(description || ''), String(username || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik (uygulamayı yeniden başlatın)" });
            }
        });
    },

    getRepairSupplyRequests: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_repair_supply_requests) {
                backend.get_repair_supply_requests((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, requests: [] });
            }
        });
    },

    getDeliverablePartsForDevice: async (brand, model, color, imeiOrSerial) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_deliverable_parts_for_device) {
                backend.get_deliverable_parts_for_device(brand || '', model || '', color || '', String(imeiOrSerial || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, parts: [] });
            }
        });
    },

    deliverPartToDevice: async (imeiOrSerial, itemCode, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.deliver_part_to_device) {
                backend.deliver_part_to_device(String(imeiOrSerial || ''), String(itemCode || ''), String(username || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend servis alanı eksik." });
            }
        });
    },

    getDeliveredPartsForDevice: async (imeiOrSerial) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_delivered_parts_for_device) {
                backend.get_delivered_parts_for_device(String(imeiOrSerial || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, parts: [] });
            }
        });
    },

    returnDeliveredPart: async (repairRecordId, imeiOrSerial, targetStock, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.return_delivered_part) {
                backend.return_delivered_part(
                    String(repairRecordId || ''),
                    String(imeiOrSerial || ''),
                    String(targetStock || 'GOOD'),
                    String(username || ''),
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: false, message: "Backend servis alanı eksik." });
            }
        });
    },

    getAppVersion: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_app_version) {
                backend.get_app_version((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, data: { version: "v1.0.0" } });
            }
        });
    },

    // Yazdırma mümkün mü? Slot YOKSA uygulamanın eski bir süreci çalışıyordur:
    // o sürümde printRequested işleyicisi olmadığı için window.print() sessizce
    // hiçbir şey yapmaz. Ekran bunu kullanıcıya açık bir mesajla söyler.
    getPrintSupport: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_print_support) {
                backend.get_print_support((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, supported: false, reason: "eski_surum", printer: "" });
            }
        });
    },

    // ── ETİKET ŞABLONLARI ──
    getLabelTemplates: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_label_templates) {
                backend.get_label_templates((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, templates: [] });
            }
        });
    },

    saveLabelTemplate: async (key, name, widthMm, heightMm, html, rotate, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.save_label_template) {
                backend.save_label_template(
                    String(key), String(name || ''), Number(widthMm), Number(heightMm),
                    String(html || ''), Boolean(rotate), String(username || ''),
                    (res) => resolve(JSON.parse(res))
                );
            } else {
                resolve({ success: false, message: "Uygulamanın eski bir süreci çalışıyor. Yeniden başlatın." });
            }
        });
    },

    deleteLabelTemplate: async (key) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.delete_label_template) {
                backend.delete_label_template(String(key), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Uygulamanın eski bir süreci çalışıyor." });
            }
        });
    },

    // Yazdırmadan SONRA sorulur: iş yazıcıya gitti mi, sürücü reddetti mi.
    getLastPrintResult: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_last_print_result) {
                backend.get_last_print_result((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, durum: "yok" });
            }
        });
    },

    // window.print() ÇAĞRILMADAN HEMEN ÖNCE çağrılır: basılacak etiketin kağıt
    // ölçüsünü backend'e bildirir, QPrinter bunu uygular (bkz. main_window).
    setLabelPageSize: async (widthMm, heightMm) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.set_label_page_size) {
                backend.set_label_page_size(Number(widthMm), Number(heightMm),
                    (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false });
            }
        });
    },

    // Yazıcının kağıt formları — Yazdır penceresindeki "Kağıt boyutu" listesiyle aynı.
    getPrinterForms: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_printer_forms) {
                backend.get_printer_forms((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, forms: [] });
            }
        });
    },

    // Basımda kullanılacak kağıt formunun adı. Boş gönderilirse ölçüye göre seçilir.
    // Üretim Kaydını Görüntüle → "Ara Teste Gönder" (109 → 138).
    // Açık onarım kalmışsa backend reddeder; kural orada, ekranda değil.
    sendToIntermediateTest: async (term, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.send_to_intermediate_test) {
                backend.send_to_intermediate_test(String(term || ""), String(username || ""),
                    (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Bu sürümde Ara Teste gönderme yok. Uygulamayı yeniden başlatın." });
            }
        });
    },

    setLabelForm: async (formName) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.set_label_form) {
                backend.set_label_form(String(formName || ""),
                    (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false });
            }
        });
    },

    // Yazıcı seçim penceresinden önce uygulamanın kendi baskı önizlemesi açılsın mı.
    // Windows'un yazdırma penceresindeki önizleme alanı Qt uygulamalarında doldurulamaz
    // ("Bu uygulama yazdırma önizlemesini desteklemiyor"), önizlemeyi biz gösteriyoruz.
    setPrintPreview: async (enabled, theme, labelCount) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.set_print_preview) {
                backend.set_print_preview(!!enabled, String(theme || "dark"),
                    Number(labelCount) || 0, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false });
            }
        });
    },

    // Slot yoksa mock backend devrededir; o durumda veritabanı da yok demektir.
    getDbStatus: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_db_status) {
                backend.get_db_status((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, connected: false, message: "Veritabanına ulaşılamıyor." });
            }
        });
    },

    adminSetBatchEntryStatu: async (imei, targetStatuCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.admin_set_batch_entry_statu) {
                backend.admin_set_batch_entry_statu(String(imei), Number(targetStatuCode), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik" });
            }
        });
    },

    createMission: async (m) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.create_mission(
                m.code || '', m.short_name || '', m.full_name || '', m.description || '',
                m.cost_center || '', m.department || '', m.order_number != null ? String(m.order_number) : '',
                m.mission_group_code || '', m.mission_workgroup_code || '',
                m.team_leader_mission_code || '', m.operation_manager_mission_code || '', m.administrative_manager_mission_code || '',
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    updateMission: async (id, m) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_mission(
                String(id),
                m.code || '', m.short_name || '', m.full_name || '', m.description || '',
                m.cost_center || '', m.department || '', m.order_number != null ? String(m.order_number) : '',
                m.mission_group_code || '', m.mission_workgroup_code || '',
                m.team_leader_mission_code || '', m.operation_manager_mission_code || '', m.administrative_manager_mission_code || '',
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    deleteMission: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.delete_mission(String(id), (res) => resolve(JSON.parse(res)));
        });
    },

    getFlowDgdMappings: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_flow_dgd_mappings((res) => resolve(JSON.parse(res)));
        });
    },

    createFlowDgdMapping: async (flowCode, dgdItemCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.create_flow_dgd_mapping(String(flowCode || ''), String(dgdItemCode || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    updateFlowDgdMapping: async (id, flowCode, dgdItemCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_flow_dgd_mapping(String(id), String(flowCode || ''), String(dgdItemCode || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    deleteFlowDgdMapping: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.delete_flow_dgd_mapping(String(id), (res) => resolve(JSON.parse(res)));
        });
    },

    openDeviceForDismantle: async (imei, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.open_device_for_dismantle(String(imei || ''), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    applyDgdReturn: async (deviceRef, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.apply_dgd_return(String(deviceRef || ''), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    toggleDgdRepairTeam: async (repairId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.toggle_dgd_repair_team(String(repairId || ''), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getPriceMatrixCustomers: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_price_matrix_customers((res) => resolve(JSON.parse(res)));
        });
    },

    getPriceMatrixBrands: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_price_matrix_brands((res) => resolve(JSON.parse(res)));
        });
    },

    getPriceMatrixProductTypes: async (brand) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_price_matrix_product_types(String(brand || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getPriceMatrixModels: async (brand, productType) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_price_matrix_models(String(brand || ''), String(productType || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getPriceMatrixCategories: async (brand, model, productType) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_price_matrix_categories(String(brand || ''), String(model || ''), String(productType || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getPriceMatrixItems: async (search, brand, category, model, productType) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_price_matrix_items(String(search || ''), String(brand || ''), String(category || ''), String(model || ''), String(productType || ''), async (resStr) => {
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

    getPriceMatrix: async (brand, category, model, productType) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_price_matrix(String(brand || ''), String(category || ''), String(model || ''), String(productType || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    savePriceMatrixBatch: async (rows, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.save_price_matrix_batch(JSON.stringify(rows || []), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    bulkImportPriceMatrix: async (rows, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.bulk_import_price_matrix(JSON.stringify(rows || []), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getEffectivePrice: async (itemCode, customerCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_effective_price(String(itemCode || ''), String(customerCode || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getPricesForItems: async (itemCodes, customerCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            const csv = Array.isArray(itemCodes) ? itemCodes.join(',') : String(itemCodes || '');
            backend.get_prices_for_items(csv, String(customerCode || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    // ── Müşteri Hedef Fiyat Matrisi ──────────────────────────────
    getTargetPriceCustomers: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_target_price_customers((res) => resolve(JSON.parse(res)));
        });
    },

    getTargetPriceBrands: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_target_price_brands((res) => resolve(JSON.parse(res)));
        });
    },

    getTargetPriceModels: async (brand) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_target_price_models(String(brand || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getCustomerTargetPrices: async (customerCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_customer_target_prices(String(customerCode || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    createCustomerTargetPrice: async (customerCode, productFamilyCode, screenTestResult, powerTestResult, targetPrice, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.create_customer_target_price(
                String(customerCode || ''), String(productFamilyCode || ''), String(screenTestResult || ''),
                String(powerTestResult || ''), String(targetPrice || ''), String(username || ''),
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    updateCustomerTargetPrice: async (id, targetPrice, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_customer_target_price(String(id || ''), String(targetPrice || ''), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    deleteCustomerTargetPrice: async (id) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.delete_customer_target_price(String(id || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    bulkImportCustomerTargetPrices: async (rows, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.bulk_import_customer_target_prices(JSON.stringify(rows || []), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    updateCustomerDiagnosis: async (workOrderId, diagnosisText, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_customer_diagnosis(String(workOrderId), String(diagnosisText || ''), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    addRepairRecord: async (workOrderId, missionGroupCode, warrantyCode, notes, username, partItemCode, itemFaultCode, operationTypeCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.add_repair_record(
                String(workOrderId), String(missionGroupCode), String(warrantyCode || ''), String(notes || ''), String(username || ''),
                String(partItemCode || ''), String(itemFaultCode || ''), String(operationTypeCode || ''),
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    updateRepairRecord: async (repairId, missionGroupCode, warrantyCode, notes, username, partItemCode, itemFaultCode, operationTypeCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_repair_record(
                String(repairId), String(missionGroupCode), String(warrantyCode || ''), String(notes || ''), String(username || ''),
                String(partItemCode || ''), String(itemFaultCode || ''), String(operationTypeCode || ''),
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    deleteRepairRecord: async (repairId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.delete_repair_record(String(repairId), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getItemFaults: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_item_faults) {
                backend.get_item_faults((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, item_faults: [] });
            }
        });
    },

    getServiceRequestTypesByCategory: async (itemCategory) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_service_request_types_by_category(String(itemCategory || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getItemFaultsByCategory: async (itemCategory) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_item_faults_by_category(String(itemCategory || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getRepairItemOperationTypes: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_repair_item_operation_types) {
                backend.get_repair_item_operation_types((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, operation_types: [] });
            }
        });
    },

    getRepairItemWarranties: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_repair_item_warranties) {
                backend.get_repair_item_warranties((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, warranties: [] });
            }
        });
    },

    getTestDetectedParts: async (deviceRef) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_test_detected_parts) {
                backend.get_test_detected_parts(String(deviceRef || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, parts: [] });
            }
        });
    },

    submitDismantleDecision: async (imei, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.submit_dismantle_decision(String(imei), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    getDismantleDecisionPreview: async (imei) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_dismantle_decision_preview) {
                backend.get_dismantle_decision_preview(String(imei || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: 'Bridge slot not available' });
            }
        });
    },

    updateRepairStatus: async (repairId, newStatusCode, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_repair_status(String(repairId), String(newStatusCode), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    updateRepairWarranty: async (repairId, warrantyCode, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.update_repair_warranty(String(repairId), String(warrantyCode), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    // Teknisyene Atama — görev grubuna göre teknisyen listesi.
    // missionCode boş gönderilirse tüm aktif kullanıcılar döner.
    getTechniciansForMission: async (missionCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_technicians_for_mission(String(missionCode || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    // Kaydı teknisyene atar ve statüyü 1001 yapar (tek işlem).
    // technicianUsername boş gönderilirse atama kaldırılır, statü 1000'e döner.
    assignTechnicianToRepair: async (repairId, technicianUsername, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.assign_technician_to_repair(String(repairId), String(technicianUsername || ''), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    // Depocunun parça teslimi: durumu "Stoktan Çıktı" yapar.
    // Ön koşullar (statü 1001, parça eklenmiş, daha önce teslim edilmemiş,
    // depo yetkisi) backend'de doğrulanır. Stok hareketi yalnızca stok
    // takipli parçalarda oluşur.
    deliverRepairPart: async (repairId, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.deliver_repair_part(String(repairId), String(username || ''), (res) => resolve(JSON.parse(res)));
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
                        { id: 1, name: "Ekran / LCD" },
                        { id: 2, name: "Batarya" },
                        { id: 3, name: "Kasa / Back Cover" },
                        { id: 4, name: "Ön Cam / Front Glass" },
                        { id: 5, name: "Arka Cam / Back Glass" },
                        { id: 6, name: "Anakart / Mainboard" },
                        { id: 7, name: "Ön Kamera / Front Camera" },
                        { id: 8, name: "Arka Kamera / Main Camera" },
                        { id: 9, name: "Şarj Soketi / Charging Connector" },
                        { id: 10, name: "Ahize / Receiver" },
                        { id: 11, name: "Hoparlör / Speaker" },
                        { id: 12, name: "Mikrofon / Microphone" },
                        { id: 13, name: "NFC" },
                        { id: 14, name: "Titreşim / Vibration Engine" },
                        { id: 15, name: "Sensör / Sensor FPC" }
                    ]
                });
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

    // ==========================
    // SERVİS KAYITLARI
    // ==========================
    getRepairDetailsByImei: async (imei) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_repair_details_by_imei(imei, (res) => resolve(JSON.parse(res)));
        });
    },

    findDeviceByTerm: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.find_device_by_term(String(term), (res) => resolve(JSON.parse(res)));
        });
    },

    getServiceInfoByImei: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_service_info_by_imei(String(term), (res) => resolve(JSON.parse(res)));
        });
    },

    getPhonecheckHistoryByImei: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_phonecheck_history_by_imei(String(term), (res) => resolve(JSON.parse(res)));
        });
    },

    getTestSummaryByImei: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_test_summary_by_imei) {
                backend.get_test_summary_by_imei(String(term), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik (get_test_summary_by_imei)" });
            }
        });
    },

    getStatusHistoryByImei: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_status_history_by_imei(String(term), (res) => resolve(JSON.parse(res)));
        });
    },

    getDetectedPartsByImei: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_detected_parts_by_imei(String(term), (res) => resolve(JSON.parse(res)));
        });
    },

    getRepairRecordsByImei: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_repair_records_by_imei(String(term), (res) => resolve(JSON.parse(res)));
        });
    },

    saveServiceRepair: async (data) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.save_service_repair(JSON.stringify(data), (res) => resolve(JSON.parse(res)));
        });
    },

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

    // DİKKAT: aşağıdaki argüman sırası create_service_record slotunun imzasıyla
    // birebir aynı olmalı. imei_number product_code ile color arasında yer alır;
    // atlanırsa argüman sayısı tutmaz, QWebChannel çağrıyı hiç yapmaz ve kaydet
    // butonu sonsuza kadar yanıt bekler.
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
                    rec.imei_number || '',
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
                    rec.imei_number || '',   // create_service_record ile aynı sıra
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

    getServiceRepairDetails: async (workOrderId) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_service_repair_details) {
                backend.get_service_repair_details(String(workOrderId), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: 'Servis bağlantısı yok.' });
            }
        });
    },

    saveServiceRepairDetails: async (workOrderId, detailsJson) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.save_service_repair_details) {
                backend.save_service_repair_details(String(workOrderId), detailsJson, (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: 'Servis bağlantısı yok.' });
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
                backend.remove_work_order_part(JSON.stringify({ id: wopId, reason: reason || '' }), (res) => {
                    try { resolve(JSON.parse(res)); } catch (e) { resolve({ success: false, message: 'Parse error' }); }
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
                backend.remove_work_order_part(JSON.stringify({ id: wopId, reason: reason || '' }), (res) => {
                    try { resolve(JSON.parse(res)); } catch (e) { resolve({ success: false, message: 'Parse error' }); }
                });
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
                backend.get_production_runs(async (resStr) => {
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
                    } catch (e) {
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

    getProducts: async (page = 1, limit = 50, searchTerm = '', categoryFilter = '', sortKey = '', sortDir = '') => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_products) {
                backend.get_products(page, limit, searchTerm, categoryFilter, sortKey, sortDir, (resStr) => {
                    try {
                        const res = JSON.parse(resStr);
                        resolve(res);
                    } catch (e) {
                        resolve({ success: false, message: e.message });
                    }
                });
            } else {
                resolve({ success: false, message: "Backend hook bulunamadı." });
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

    bulkImportProducts: async (rows) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.bulk_import_products(JSON.stringify(rows || []), (res) => resolve(JSON.parse(res)));
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

    getStockForPart: async (partId) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_stock_for_part) {
                backend.get_stock_for_part(String(partId), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, stock: [] });
            }
        });
    },

    getStockByItemCode: async (itemCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_stock_by_item_code) {
                backend.get_stock_by_item_code(String(itemCode || ''), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, quantity: 0 });
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

    bulkImportInboundEntries: async (rows, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.bulk_import_inbound_entries(JSON.stringify(rows || []), String(username || ''), (res) => resolve(JSON.parse(res)));
        });
    },

    addOutboundEntry: async (partId, locId, qty, typeStr, user, technician, description, targetLocId) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.add_outbound_entry) {
                backend.add_outbound_entry(String(partId), String(locId), String(qty), typeStr, user, technician || "", description || "", String(targetLocId || ""), (res) => resolve(JSON.parse(res)));
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
                backend.get_item_boms(async (resStr) => {
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

    bulkImportProductBOM: async (rows) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.bulk_import_product_bom(JSON.stringify(rows || []), (res) => resolve(JSON.parse(res)));
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

    importDefinedBatchEntry: async (data) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.import_defined_batch_entry) {
                backend.import_defined_batch_entry(JSON.stringify(data), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, ok: false, message: "Backend eksik (import_defined_batch_entry)" });
            }
        });
    },

    bulkProcessBatchEntries: async (rows) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.bulk_process_batch_entries(JSON.stringify(rows || []), (res) => resolve(JSON.parse(res)));
        });
    },

    validateBatchEntry: async (data) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.validate_batch_entry) {
                backend.validate_batch_entry(JSON.stringify(data), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, ok: true, message: "" });
            }
        });
    },

    getPhonecheckDeviceByImei: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_phonecheck_device_by_imei) {
                backend.get_phonecheck_device_by_imei(String(term), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, found: false, message: "Backend eksik (get_phonecheck_device_by_imei)" });
            }
        });
    },

    // Yerel phonecheck_test_results tablosundan en güncel kaydı (tüm alanlar) çeker — canlı API'ye gitmez.
    getPhonecheckStoredByImei: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_phonecheck_stored_by_imei) {
                backend.get_phonecheck_stored_by_imei(String(term), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, found: false, message: "Backend eksik (get_phonecheck_stored_by_imei)" });
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
    },

    bulkInsertTableData: async (schema, table, rows) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.bulk_insert_table_data) {
                backend.bulk_insert_table_data(schema, table, JSON.stringify(rows || []), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend bridge missing" });
            }
        });
    },

    // ==========================
    // MODUL 5: STATE MACHINE / STATU GECIS EKRANLARI
    // ==========================

    getDeviceByBarcode: async (barcode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_device_by_barcode(String(barcode), (res) => resolve(JSON.parse(res)));
        });
    },

    getAllStatuTransitions: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_all_statu_transitions((res) => resolve(JSON.parse(res)));
        });
    },

    getAllowedTransitions: async (currentStatuCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_allowed_transitions(currentStatuCode, (res) => resolve(JSON.parse(res)));
        });
    },

    executeStatuTransition: async (workOrderId, currentStatuCode, targetStatuCode, requestTypeCode, testResultCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.execute_statu_transition(
                String(workOrderId), currentStatuCode, targetStatuCode,
                requestTypeCode || "", testResultCode || "",
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    transferToDoa: async (workOrderId) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.transfer_to_doa(String(workOrderId), (res) => resolve(JSON.parse(res)));
        });
    },

    getBatchEntriesByStatu: async (statuCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_batch_entries_by_statu(statuCode, (res) => resolve(JSON.parse(res)));
        });
    },

    scanBatchEntryStatu: async (term) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.scan_batch_entry_statu(String(term), (res) => resolve(JSON.parse(res)));
        });
    },

    executeBatchEntryStatuTransition: async (entryId, currentStatuCode, targetStatuCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.execute_batch_entry_statu_transition(
                String(entryId), currentStatuCode, targetStatuCode,
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    openProjectGuide: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.open_project_guide) {
                backend.open_project_guide((res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik (open_project_guide)" });
            }
        });
    },

    // logExitTest son parametredir ve Qt slotunda ZORUNLUDUR (@Slot(...,bool)).
    // Gönderilmezse QWebChannel argüman sayısı uyuşmadığı için çağrıyı hiç
    // yapmaz, callback tetiklenmez ve ekran "İşleniyor..." halinde kilitlenir.
    submitTestResult: async (entryId, currentStatuCode, successStatuCode, failStatuCode, result, description, faultLines, logExitTest = false) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.submit_test_result(
                String(entryId), currentStatuCode, successStatuCode, failStatuCode, result, description || '', JSON.stringify(faultLines || []),
                Boolean(logExitTest),
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    fetchPhonecheckTest: async (term, currentStatuCode, targetStatuCode, note) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.fetch_phonecheck_test(
                String(term), currentStatuCode, targetStatuCode, String(note || ''),
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    fetchPhonecheckAndTransition: async (imei) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.fetch_phonecheck_and_transition) {
                backend.fetch_phonecheck_and_transition(String(imei), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik (fetch_phonecheck_and_transition)" });
            }
        });
    },

    savePhonecheckManual: async (imei, testStage, manualReason, enteredBy, fields) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.save_phonecheck_manual(
                String(imei), String(testStage), String(manualReason),
                String(enteredBy || ''), JSON.stringify(fields || {}),
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    getRepairOperationsByImei: async (imei) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.get_repair_operations_by_imei(String(imei), (res) => resolve(JSON.parse(res)));
        });
    },

    getRepairPoolByDepartment: async (departmentCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_repair_pool_by_department) {
                backend.get_repair_pool_by_department(String(departmentCode), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik (get_repair_pool_by_department)" });
            }
        });
    },

    getDepartmentTechnicians: async (departmentCode) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_department_technicians) {
                backend.get_department_technicians(String(departmentCode), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik (get_department_technicians)" });
            }
        });
    },

    assignRepairToTechnician: async (departmentCode, imeiOrTerm, technicianUsername) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.assign_repair_to_technician) {
                backend.assign_repair_to_technician(String(departmentCode), String(imeiOrTerm), String(technicianUsername), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: false, message: "Backend eksik (assign_repair_to_technician)" });
            }
        });
    },

    // Cihaz İade Prosedürü: deviceRef, add_repair_record ile aynı desen - bağlı bir
    // SERVICE iş emri varsa work_order_id, yoksa cihazın IMEI'sidir.
    executeDeviceReturn: async (deviceRef, returnReason, username) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            backend.execute_device_return(
                String(deviceRef || ''), String(returnReason || ''), String(username || ''),
                (res) => resolve(JSON.parse(res))
            );
        });
    },

    getDashboardStats: async () => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_dashboard_stats) {
                backend.get_dashboard_stats((res) => resolve(JSON.parse(res)));
            } else {
                resolve({
                    success: true,
                    stats: {
                        totalParts: '12,458',
                        totalStock: '84,291',
                        lowStock: '23',
                        criticalStock: '0',
                        todaysInbound: '0',
                        todaysOutbound: '0',
                        activeLocations: '0'
                    }
                });
            }
        });
    },

    getRecentStockMovements: async (limit = 5) => {
        const backend = await getBackend();
        return new Promise((resolve) => {
            if (backend.get_recent_stock_movements) {
                backend.get_recent_stock_movements(String(limit), (res) => resolve(JSON.parse(res)));
            } else {
                resolve({ success: true, movements: [] });
            }
        });
    }
};
