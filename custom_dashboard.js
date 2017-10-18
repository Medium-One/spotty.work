(function () {
    'use strict';

    angular
        .module('app.M1DashboardController')
        .controller('M1DashboardController', M1DashboardController);

    M1DashboardController.$inject = ['$scope', '$timeout', '$window', 'ChartData',
        'APP_MEDIAQUERY', '$http', '$filter',
        'DTOptionsBuilder', 'DTColumnDefBuilder', 'DTDefaultOptions'
    ];

    function M1DashboardController($scope, $timeout, $window, ChartData,
        APP_MEDIAQUERY, $http, $filter,
        DTOptionsBuilder, DTColumnDefBuilder, DTDefaultOptions) {


        $scope.edit_flag = false;
        var vm = this;

        if (!Array.from) {
            Array.from = (function () {
                var toStr = Object.prototype.toString;
                var isCallable = function (fn) {
                    return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
                };
                var toInteger = function (value) {
                    var number = Number(value);
                    if (isNaN(number)) {
                        return 0;
                    }
                    if (number === 0 || !isFinite(number)) {
                        return number;
                    }
                    return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
                };
                var maxSafeInteger = Math.pow(2, 53) - 1;
                var toLength = function (value) {
                    var len = toInteger(value);
                    return Math.min(Math.max(len, 0), maxSafeInteger);
                };

                // The length property of the from method is 1.
                return function from(arrayLike /*, mapFn, thisArg */) {
                    // 1. Let C be the this value.
                    var C = this;

                    // 2. Let items be ToObject(arrayLike).
                    var items = Object(arrayLike);

                    // 3. ReturnIfAbrupt(items).
                    if (arrayLike == null) {
                        throw new TypeError("Array.from requires an array-like object - not null or undefined");
                    }

                    // 4. If mapfn is undefined, then let mapping be false.
                    var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
                    var T;
                    if (typeof mapFn !== 'undefined') {
                        // 5. else
                        // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
                        if (!isCallable(mapFn)) {
                            throw new TypeError('Array.from: when provided, the second argument must be a function');
                        }

                        // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
                        if (arguments.length > 2) {
                            T = arguments[2];
                        }
                    }

                    // 10. Let lenValue be Get(items, "length").
                    // 11. Let len be ToLength(lenValue).
                    var len = toLength(items.length);

                    // 13. If IsConstructor(C) is true, then
                    // 13. a. Let A be the result of calling the [[Construct]] internal method of C with an argument list containing the single item len.
                    // 14. a. Else, Let A be ArrayCreate(len).
                    var A = isCallable(C) ? Object(new C(len)) : new Array(len);

                    // 16. Let k be 0.
                    var k = 0;
                    // 17. Repeat, while k < len… (also steps a - h)
                    var kValue;
                    while (k < len) {
                        kValue = items[k];
                        if (mapFn) {
                            A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
                        } else {
                            A[k] = kValue;
                        }
                        k += 1;
                    }
                    // 18. Let putStatus be Put(A, "length", len, true).
                    A.length = len;
                    // 20. Return A.
                    return A;
                };
            }());
        }


        activate();

        function activate() {

            // set vm variables
            vm.portal_ep = "../../..";
            vm.load_msg = 'Loading...';

            var tableLoadCounter = 0; // track table loading

            var dtOptions = DTOptionsBuilder // main table settings
                .newOptions()
                .withPaginationType('numbers')
                .withDisplayLength(25)
                .withBootstrap()
                .withLanguage({
                    sSearch: '<i class="fa fa-search"></i>'
                })
                .withOption("processing", true)
                .withOption("initComplete", function (settings, json) { // don't show table until complete 
                    tableLoadCounter++;
                    if (tableLoadCounter >= 2) { // first init is before data is loaded
                        document.getElementById("table_wrap").style.opacity = 1;
                    }
                });

            // function used by JS to convert timestamp //
            var isoToFriendly = function (iso_ts) {
                var date = new Date(iso_ts).toLocaleDateString();
                var time = new Date(iso_ts).toLocaleTimeString();
                return date + " " + time;
            }

            // function used by JS to convert timestamp //
            var isoToHhmmss = function (iso_ts) {
                var time = new Date(iso_ts);
                var result = ("0" + time.getHours()).slice(-2) + ":" +
                    ("0" + time.getMinutes()).slice(-2) + ":" +
                    ("0" + time.getSeconds()).slice(-2);
                return result;
            }

            // returns function used by data table
            var compose = function () {
                var args = Array.from(arguments);

                if (args.length == 1) {
                    return args[0];
                } else {
                    var fst = args[0];

                    var rst = args.slice(1);
                    var rst_func = compose.apply(this, rst);
                    return function (d) {
                        return rst_func(fst(d));
                    };
                }
            }

            var get_key = function (key) {
                return function (d) {
                    return d[key];
                };
            }

            var wrap_value = function (datum) {
                if (datum == undefined) {
                    return {
                        'value': ''
                    };
                } else {
                    return {
                        'value': datum
                    };
                }
            }

            // get all devices and LV //
            var get_all_devices_data = function () {
                return $http.post('../../../device_list_in_tenant');
            }

            // function used by refresh button for main table
            vm.refreshTable = function () {
                vm.tableLoadCounter = 1;
                document.getElementById("main_loading").style.display = "inline";
                vm.selected_device = undefined;
                vm.cur_device = undefined;
                loadAllDeviceTable(table, get_all_devices_data);
            }

            // load device data for main table //
            function loadAllDeviceTable(table, query_func) {

                var key_funcs = table.key_funcs;

                var handle_error = function (reason) {
                    vm.load_msg = reason.data.title;
                    console.log("Failed to load table data because of: ", reason);
                }

                var process_row = function (event) {
                    return key_funcs.map(function (key_func, index) {
                        var obj = key_func(event);
                        if (index == 2) {
                            obj.occupied_tag = true;

                            if (obj.value == 0) {
                                obj.occupied = 0;
                                obj.value = "Available"
                            } else if (obj.value == 1) {
                                obj.occupied = 1;
                                obj.value = "Occupied"
                            } else {
                                obj.value = "Board Offline"
                            }
                        } else {
                            obj.occupied_tag = false;
                        }
                        return obj;
                    });
                }

                var handle_data = function (response) {
                    document.getElementById("main_loading").style.display = "none";
                    var data = response['data'];
                    if (data.length == 0) return;

                    $scope.num_available = data.filter(function (datum) {
                        return datum["processed.occupied"] == 0;
                    }).length;
                    $scope.total_rows = data.length;

                    var processed_rows = data.map(process_row);
                    table.unfiltered_data = data;
                    table.data = processed_rows.map(function (item) {
                        return item.map(function (elem) {
                            if (typeof elem.value == 'number') {
                                elem.value = Math.round(elem.value);
                            }
                            return elem;
                        })
                    })
                    table.enabled = true;
                }

                var promise = query_func();
                promise.then(handle_data, handle_error);
            }

            var tableKeys = [];

            vm.setTableKeys = function (keys) {
                for (var j = 0; j < keys.length; j++) {
                    tableKeys.push(compose(get_key(keys[j]), wrap_value));
                }
            }

            var table = {
                'name': 'Devices',
                'header': [],
                'key_funcs': tableKeys,
                'data': [],
                'unfiltered_data:': [],
                'dtOptions': dtOptions,
                'dtInstance': {}
            };

            vm.table = table;

            // configure options for the individual device table //
            var device_popup_table_options = DTOptionsBuilder
                .newOptions()
                .withDisplayLength(14)
                .withOption('paging', false)
                .withOption('searching', false)
                .withOption('info', false)
                .withOption('ordering', false)

            var cur_device_popup_table = {
                'name': 'Popup Log',
                'placeholder': [],
                'dtOptions': device_popup_table_options,
                'dtInstance': {},
                'enabled': true
            };

            vm.cur_device_popup_table = cur_device_popup_table;
            vm.cur_device = undefined;
            vm.selected_device = undefined;
            vm.cur_idx = undefined;

            // this is a command used by html for textbox // 
            vm.sendTextbox = function (key, textbox_id) {
                var name = vm.selected_device.device_id;
                var text = document.getElementById(textbox_id).value;
                $http.post(vm.portal_ep + '/send_event?device_id=' + name + '&tag=' + key + '&value=' + text);
            }

            // default options for line graphs.  used by html //
            vm.graphLineOptions = {
                series: {
                    lines: {
                        show: true,
                        fill: 0.01
                    },
                    points: {
                        show: true,
                        radius: 4
                    }
                },
                grid: {
                    borderColor: 'rgba(162, 162,152,0)',
                    borderWidth: 1,
                    hoverable: true,
                    backgroundColor: 'transparent'
                },
                tooltip: true,
                tooltipOpts: {
                    content: function (label, x, y) {
                        return x + ' : ' + y;
                    }
                },
                xaxis: {
                    tickColor: 'rgba(162, 162, 162, .26)',
                    font: {
                        color: '#b0bec5'
                    },
                    mode: 'categories'
                },
                yaxis: {
                    position: ($scope.app.layout.rtl ? 'right' : 'left'),
                    tickColor: 'rgba(162,162,162.26)',
                    font: {
                        color: '#b0bec5'
                    }
                },
                shadowSize: 0
            };

            // functions to load LV values //
            vm.lvTagArray = [];
            vm.lvResponseArray = [];
            vm.lvResponseTsArray = [];
            vm.lvRowUpdatedArray = [];
            vm.lvRowStyleArray = [];
            vm.lvRefreshDoneArray = [];
            vm.lvLookupID = {};
            vm.lvTSLookupID = {};
            vm.lvStyleLookupID = {};
            vm.addLvArray = function (tag) {
                vm.lvTagArray.push(tag);
                vm.lvResponseArray.push(0);
                vm.lvResponseTsArray.push("");
                vm.lvRowUpdatedArray.push(0);
                vm.lvRowStyleArray.push({});
                vm.lvRefreshDoneArray.push(true);
                vm.lvLookupID[tag] = 0; // added by dt to initialize
            }
            var clearLVs = function () {
                for (var i = 0; i < vm.lvResponseArray.length; i++) {
                    vm.lvResponseArray[i] = "";
                }
                for (var i = 0; i < vm.lvResponseTsArray.length; i++) {
                    vm.lvResponseTsArray[i] = "";
                }
                for (var i = 0; i < vm.lvRowStyleArray.length; i++) {
                    vm.lvRowStyleArray[i] = {};
                }
                for (var i = 0; i < vm.lvRowUpdatedArray.length; i++) {
                    vm.lvRowUpdatedArray[i] = 0;
                }
            }
            var clearAllLVRefresh = function () {
                for (var i = 0; i < vm.lvRefreshDoneArray.length; i++) {
                    vm.lvRefreshDoneArray[i] = false;
                }
            }

            var checkLVRefresh = function () {
                for (var i = 0; i < vm.lvRefreshDoneArray.length; i++) {
                    if (vm.lvRefreshDoneArray[i] == false) {
                        return false;
                    }
                }
                return true;
            }
            var loadLVs = function () {
                // don't run if no LVs where configured //
                if (vm.lvTagArray.length > 0) {
                    var handle_error = function (reason) {
                        console.log("Failed to load LV data because of: ", reason);
                    }

                    var handle_data = function (response) {
                        var data = response['data'];
                        for (var i = 0; i < response['data'].length; i++) {
                            if (response['data'][i].length > 0) { // this means no empty array returned

                                vm.lvLookupID[vm.lvTagArray[i]] = (typeof response['data'][i][0][vm.lvTagArray[i]]) == 'number' ? Math.round(response['data'][i][0][vm.lvTagArray[i]]) : response['data'][i][0][vm.lvTagArray[i]];

                                var old_time = vm.lvResponseTsArray[i];
                                vm.lvTSLookupID[vm.lvTagArray[i]] = isoToFriendly(response['data'][i][0]['timestamp']);;

                                //change the row style to green if new data is available
                                if (vm.lvResponseTsArray[i] != old_time) {
                                    vm.lvRowUpdatedArray[i]++;
                                    if (vm.lvRowUpdatedArray[i] > 1) {
                                        vm.lvStyleLookupID[vm.lvTagArray[i]] = {
                                            "font-weight": "bold",
                                            "color": "green"
                                        };
                                    } else {
                                        vm.lvStyleLookupID[vm.lvTagArray[i]] = {};
                                    }
                                }
                                vm.lvRefreshDoneArray[i] = true;
                            } else {
                                vm.lvResponseArray[i] = "";
                                vm.lvResponseTsArray[i] = "";
                                vm.lvRefreshDoneArray[i] = true;
                                vm.lvRowStyleArray[i] = []
                            }
                        }
                    }
                    var get_data = function () {
                        var name = vm.selected_device.device_id;
                        var post_url = vm.portal_ep + '/last_n_values?device_id=' + name
                        for (var i = 0; i < vm.lvTagArray.length; i++) {
                            post_url += '&tag=' + vm.lvTagArray[i];
                            post_url += '&limit=1';
                        }
                        return $http.get(post_url);
                    }
                    get_data().then(handle_data, handle_error);
                }
            }

            // functions to load graphs //
            vm.graphTagArray = [];
            vm.graphLabalArray = [];
            vm.graphColorArray = [];
            vm.graphResponseArray = [];
            vm.graphRefreshDoneArray = [];
            vm.addGraphArray = function (tags, labels, colors) {
                vm.graphTagArray.push(tags);
                vm.graphLabalArray.push(labels);
                vm.graphColorArray.push(colors);
                vm.graphResponseArray.push([]);
                vm.graphRefreshDoneArray.push(true);
            }

            // the follow 2 functions are busy flags while map loads to ensure no new queries until prior ones are done //
            var clearAllGraphRefresh = function () {
                for (var i = 0; i < vm.graphRefreshDoneArray.length; i++) {
                    vm.graphRefreshDoneArray[i] = false;
                }
            }

            var checkGraphRefresh = function () {
                for (var i = 0; i < vm.graphRefreshDoneArray.length; i++) {
                    if (vm.graphRefreshDoneArray[i] == false) {
                        return false;
                    }
                }
                return true;
            }

            var getResourceSize = function (resource) {
                var size = 0;
                while (true) {
                    if (size in resource) {
                        size++;
                    } else {
                        break;
                    }
                }
                return size
            }
            var clearGraph = function () {
                for (var i = 0; i > vm.graphResponseArray.length; i++) {
                    vm.graphResponseArray[i] = [];
                }
            }
            var loadGraph = function () {
                // don't run if no graphs where configured //
                if (vm.graphTagArray.length > 0) {
                    var handle_error = function (reason) {
                        console.log("Failed to load graph data because of: ", reason);
                    }

                    // for some reason the parameters is reversed from ChartData.load : TODO fix/ai
                    var handle_data = function (graph_number, response) {
                        var graph_response = [];

                        for (var i = 0; i < response.length; i++) {
                            var graph_line = {
                                label: vm.graphLabalArray[graph_number][i],
                                color: vm.graphColorArray[graph_number][i]
                            };

                            graph_line.data = []
                            // note: need to reverse array due to ordering
                            for (var j = getResourceSize(response[i]); j > 0; j--) {
                                var iso_ts = response[i][j - 1]['timestamp'];

                                var ts_hhmmss = isoToHhmmss(iso_ts);

                                var key = vm.graphTagArray[graph_number][i];

                                var value = response[i][j - 1][key];

                                var point = new Array(ts_hhmmss, value);

                                graph_line["data"].push(point);

                            }
                            graph_response.push(graph_line);
                        }
                        // bind response to html
                        vm.graphRefreshDoneArray[graph_number] = true; // flag completion of this chart
                        vm.graphResponseArray[graph_number] = graph_response;
                    }
                    // note because the graphs can have multiple lines, this is nested //
                    var get_data = function () {
                        var name = vm.selected_device.device_id;
                        for (var i = 0; i < vm.graphTagArray.length; i++) {
                            var post_url = vm.portal_ep + '/last_n_values?device_id=' + name;
                            for (var j = 0; j < vm.graphTagArray[i].length; j++) {
                                post_url += '&tag=' + vm.graphTagArray[i][j];
                                post_url += '&limit=9';
                            }
                            ChartData.load(post_url)["$promise"].then(handle_data.bind(null, i));
                        }
                    }
                    get_data();
                }
            }

            var showAllWidgets = function () {

                var spinner = document.getElementById("loading_spinner");
                if (spinner) {
                    spinner.style.display = "none";
                }
                if (document.getElementById("buttons")) {
                    document.getElementById("buttons").style.opacity = 1;
                }
                if (document.getElementById("textbox")) {
                    document.getElementById("textbox").style.opacity = 1;
                }
                if (document.getElementById("table")) {
                    document.getElementById("table").style.opacity = 1;
                }
            }
            var hideAllWidgets = function () {

                if (document.getElementById("buttons")) {
                    document.getElementById("buttons").style.opacity = 0;
                }
                if (document.getElementById("textbox")) {
                    document.getElementById("textbox").style.opacity = 0;
                }
                if (document.getElementById("table")) {
                    document.getElementById("table").style.opacity = 0;
                }
            }


            // clears when widget first loads //
            var clearAll = function () {
                clearAllGraphRefresh();
                clearAllLVRefresh();
                clearLVs();
                clearGraph();
                if (cur_device_popup_table.dtInstance.DataTable) {
                    cur_device_popup_table.dtInstance.DataTable.destroy();
                }
            }
            // clear flags for widget refresh //
            var refreshAllWidgets = function () {
                clearAllGraphRefresh();
                clearAllLVRefresh();
                loadLVs();
                loadGraph()
            }

            // MAIN FUNCTION to load Device Data //
            var loadIndividualDeviceData = function (idx) {
                // get device name from main table
                var name = table.unfiltered_data[idx].name;

                var handle_message = function (response) {
                    vm.message = response['data']['value'];
                    console.log("handle_message error:" + response['data']);
                }

                refreshAllWidgets();
                hideAllWidgets();

                // Settings for refreah rate
                var refresh_rate = 2000; //milliseconds
                var page_timeout = 1800000; //300 seconds = 5 minutes; 1800 seconds is 30 mins
                var secondCounter = 0;

                var handle_err = function (reason) {
                    console.log("Failed to refresh table because of " + reason);
                }

                var refreshData = setInterval(function () {
                    if (!vm.selected_device || idx != vm.cur_idx || secondCounter >= page_timeout) {
                        clearInterval(refreshData);
                    } else if (checkGraphRefresh() && checkLVRefresh()) {
                        console.log("not busy");
                        secondCounter += refresh_rate;
                        refreshAllWidgets();
                        showAllWidgets();
                    } else {
                        console.log("busy");
                    }
                }, refresh_rate);
            }

            // vm.showGraphs = true;
            // Used by main table for selected device //
            vm.select_device = function (idx) {
                clearAll();
                vm.selected_device = table.unfiltered_data[idx];
                vm.cur_idx = idx;
                loadIndividualDeviceData(idx);
            }

            loadAllDeviceTable(table, get_all_devices_data);
        }
    }
})();
