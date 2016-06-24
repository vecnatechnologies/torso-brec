(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['jquery', 'underscore', 'handlebars', 'backbone-torso/modules/View'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('jquery'), require('underscore'), require('handlebars'), require('backbone-torso/modules/View'));
  } else {
    root.Torso.View = factory(root.$, root._, root.Handlebars, root.View);
  }
}(this, function($, _, Handlebars, View) {
  'use strict';

  /**
   * A view to handle BREC tables.
   *
   * Requires the initialization of a collection in the form of
   *    this.collection = this.createPrivateCollection(entryCacheCollection);
   *
   * @class BrecTableView
   */
  var brecView = View.extend({
    /*
     * This string is required by DataTables to display the table controls in the desired format.
     * See DataTables documentation: https://datatables.net/reference/option/dom
     */
    tableControls: '<"top-pagination" p><"filters" <"filter-row" <"showing-filter" li><"search-filter" f>>>rtp',
    columnSortingOrder: [],
    colVisConfig: {
      'buttonText': "<span class='action-option icon-eye-open'></span>",
      'restore': "Restore"
    },


    // ----- Callback API ----------------------------------------------------------------------------------------------------------

    /**
     * Initializes the columns of the BREC table. Column information is used in _translateData.
     * columnInit should use _buildColumnConfig to properly format each column's information.
     * The ordering of these items is very important as it determines what will be sent out in the orderCol queryParam.
     * @method columnInit
     * @return {Object[]} Returns the information to be used in constructing the columns
     */
    columnInit: _.noop,

    /**
     * Specifies what to do when the server call is successful.
     * Default method may be overridden.
     * @method successfulServerRetrieval
     */
    successfulServerRetrieval: _.noop,

    /**
     * Specifies what to do when the server call is unsuccessful.
     * Default method may be overridden.
     * @method errorServerRetrieval
     */
    errorServerRetrieval: _.noop,

    /**
     * Additional criteria to use when retrieving the ids.  Will be merged with the table parameters.
     * @method additionalSearchCriteria
     */
    additionalSearchCriteria: _.noop,

    /**
     * Another way to override the search criteria if you need to modify how tableParams are included, or need to base
     * the new criteria off of table parameters.
     * @method getSearchCriteria
     * @param tableParams {Object} the current settings for the display table to search with.
     */
    getSearchCriteria: function(tableParams) {
      var searchCriteria = _.extend({}, _.result(this, 'additionalSearchCriteria'), tableParams);
      return searchCriteria;
    },


    // ----- Overrides -------------------------------------------------------------------------------------------------------------

    /**
     * Override the constructor to make extending this class easier (do not need to call the parent initialize).
     * @method constructor
     * @override
     */
    constructor: function() {
      _.bindAll(this, '_updateFixedHeaderPos', '_requestData');
      View.apply(this, arguments);
      this.columnConfig = this.columnInit();
      // Activate BREC event listeners
      this.listenTo(this.viewState, 'change:dataTable.successServerRetrieval', function(viewState, successful) {
        if (successful) {
          this.successfulServerRetrieval(arguments);
        } else {
          this.errorServerRetrieval(arguments);
        }
      });
      this.listenTo(this.viewState, 'change:dataTable.params', this._fetchDataTableIds);
    },

    /**
     * Override updateDOM to only render the template and widget the first time.  Subsequent renders use datatables
     * to redraw the table based on changes to data.
     * @method updateDOM
     * @override
     */
    updateDOM: function() {
      if (!this.get('dataTable.DOMDrawnOnce')) {
        this.set('dataTable.DOMDrawnOnce', true);
        View.prototype.updateDOM.apply(this);
        // The following 2 methods require the $el to already be generated.
        this._brecTableInit();
        this._brecWidgetsInit();
      } else {
        this._reloadAndRedrawDataTable();
      }
    },

    /**
     * Fetch the ids to display for the current page of the data table.
     * Pulled out here because the expected result is a partial list which has info about the total number of items.
     * @method  _fetchDataTableIds
     * @private
     */
    _fetchDataTableIds: function() {
      this.set('dataTable.fetchingIds', true);
      var tableParams = this.get('dataTable.params');
      var searchCriteria = this.getSearchCriteria(tableParams);
      $.ajax({
        url: this.url,
        method: 'POST',
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        data: JSON.stringify(searchCriteria),
        context: this
      }).done(function(idsPartialList) {
          this.set('dataTable.successServerRetrieval', true);
          this.set('dataTable.idsPartialList', idsPartialList);
        })
        .fail(function() {
          this.set('dataTable.successServerRetrieval', false);
        })
        .always(function() {
          this.set('dataTable.fetchingIds', false);
        });
    },

    /**
     * Causes _requestData() to be called along with a redraw of the widget.
     * @method _reloadAndRedrawDataTable
     * @private
       */
    _reloadAndRedrawDataTable: function() {
      if (this.dataTable) {
        this.dataTable.ajax.reload(null, false);
      }
    },

    /**
     * Destroy any additional resources when the view is removed from the DOM.
     * Currently this is used to remove javascript widgets that affect the display.
     * @method _detached
     * @override
     */
    _detached: function() {
      this._brecWidgetsDestroy();
    },


    // ----- Widget Management -----------------------------------------------------------------------------------------------------

    /**
     * Initializes all of the BREC table widgets. Needs to be called after _brecTableInit.
     * Note that tables cannot both be responsive and have colVis enabled.
     * @private
     * @method _brecWidgetsInit
     */
    _brecWidgetsInit: function() {
      var view = this;

      // ColVis can only be used when the table is not responsive
      if (!this.responsiveTable) {
        // Initialize the show/hide button
        var colvis = new $.fn.dataTable.ColVis(this.dataTable, this.colVisConfig);
        this.$('.action-view').append($(colvis.button()));
      }

      // Initialize column reordering
      new $.fn.dataTable.ColReorder(this.dataTable, this.colReorderExtensions);


      // Initialize the fixed headers
      this.tableHeader = new $.fn.dataTable.FixedHeader(this.dataTable, {
        zTop: 1,
        zLeft: 0,
        zRight: 0,
        zBottom: 0
      });

      // Need to update the FixedHeader positions on window resize
      $(window).on('resize.updateFixedHeaderPosition', this._updateFixedHeaderPos);

      // Add search functionality to individual columns
      this.$(".dataTable tfoot input").on('keyup change', function () {
        view.dataTable
          .column($(this).parent().index()+':visible' )
          .search(this.value)
          .draw();
      });

    },

    /**
     * Destroys all of the BREC table widgets.
     * @private
     * @method _brecWidgetsDestroy
     */
    _brecWidgetsDestroy: function() {
      // FixedHeader generated its dom elements off of the body rather than relative to the table, so we need to clean this up.
      var fixedHeaderEl = $('.fixedHeader');
      if(fixedHeaderEl) {
        fixedHeaderEl.remove();
      }

      // Remove the window resize event.
      $(window).off('resize.updateFixedHeaderPosition');

      // Clear any column searches
      this.$('.dataTable tfoot input').off();
    },

    /**
     * Updates the position of the FixedHeader. Used to position it correctly without having to reinitialize the widget.
     * @private
     * @method _updateFixedHeaderPos
     */
    _updateFixedHeaderPos: function() {
      if (this.tableHeader) {
        this.tableHeader._fnUpdateClones(true);
      }
    },


    // ----- Table Management ------------------------------------------------------------------------------------------------------

    /**
     * Initializes the BREC table.
     * Default method may be extended with view.brecOptionsOverrides.
     * @method _brecTableInit
     */
    _brecTableInit: function() {
      var view = this;
      var tableEl = this.$el.find('.table-data');
      this.dataTable = $(tableEl).DataTable(_.extend({
        dom: view.tableControls,
        stateSave: true,
        serverSide: true,
        processing: false,
        responsive: view.responsiveTable || false,
        ajax: view._requestData,
        fnStateLoadCallback: function() {
          try {
            var data = JSON.parse(
              localStorage.getItem('DataTables_settings_' + location.pathname)
            );
            view.columnSortingOrder = data.columnSortingOrder;
            return data;
          } catch (e) {
            // Errors here indicate a failure to parse the settings JSON. Since this is a non-critical system, fail silently.
          }
        },
        fnStateSaveCallback: function ( settings, data ) {
          try {
            // Clear individual column searches
            for (var i = 0; i<data.columns.length; i++) {
              data.columns[i].search.search = "";
            }
            data.columnSortingOrder = view.columnSortingOrder;
            localStorage.setItem(
              'DataTables_settings_' + location.pathname, JSON.stringify( data )
            );
          } catch (e) {
            // Same as fnStateLoadCallback.
          }
        },
        columns: _.map(this._initializeAndGetColumnConfig(), function(column){return column.options;})
      }, _.result(view, 'tableOptionsExtensions')));
      _.extend(this.colVisConfig, this.colVisExtensions);
    },

    /**
     * Constructs an ajax call to retrieves the data to be used in the table. On a successful call,
     * process the data and update the table. In the event of an error, trigger the error function
     * and clear the table.
     * @private
     * @method _requestData
     * @param {Object} tableParams Parameters for the ajax request to retrieve the desired data
     * @param {Function} callback Required to be called by DataTables. Used to update display
     */
    _requestData: function(tableParams, callback) {
      this._updateColumnSortOrdering(tableParams);
      var tableParamsWithoutDrawCounter = _.clone(tableParams);
      // Remove the draw field to trigger change events correctly.
      // The draw property will increment on every call to this method.
      delete tableParamsWithoutDrawCounter.draw;
      this.set('dataTable.params', tableParamsWithoutDrawCounter);

      var idsPartialList = this.get('dataTable.idsPartialList');
      var dataTableContent = this._prepareData(tableParams, idsPartialList);
      callback(dataTableContent);
      this._updateFixedHeaderPos();
    },


    // ----- Helpers ---------------------------------------------------------------------------------------------------------------

    /**
     * Initializes the columns if they are not already and returns the result.
     * @method _initializeAndGetColumnConfig
     * @returns {Object} the column configurations.
     * @private
     */
    _initializeAndGetColumnConfig: function() {
      if (!this.columnConfig) {
        this.columnConfig = this.columnInit();
      }
      return this.columnConfig;
    },

    /**
     * The effect of this method is twofold. First it updates the view's history of column sorting orderings.
     * Second it modifies the tableParams orderings to behave as a multicolumn ordering based off of the view's
     * history even on single ordering requests.
     * @private
     * @method _updateColumnSortOrdering
     * @param {Object} tableParams Parameters for the ajax request to retrieve the desired data
     */
    _updateColumnSortOrdering: function(tableParams) {
      var columnList = tableParams.order.map(function(order) {
        return order.column;
      });

      this.columnSortingOrder = _.reject(this.columnSortingOrder, function(columnData) {
        return _.contains(columnList, columnData.column);
      });

      this.columnSortingOrder = tableParams.order.concat(this.columnSortingOrder);
      tableParams.order = this.columnSortingOrder.slice();
    },

    /**
     * Builds the column input to be in the format DataTables expects. For more information, see the
     * DataTables documentation at https://datatables.net/reference/option/columns.
     * Options must include 'data' for colReorder.
     * @private
     * @method _buildColumnConfig
     * @param {String} label The id and name of the column
     * @param {Object} columnOptions Optional functions for columns with special formatting
     * @return {Object} The correctly formatted column input
     */
    _buildColumnConfig: function(label, columnOptions) {
      return {
        'label': label,
        'options': columnOptions || {'name': label, 'data': label}
      };
    },

    /**
     * Prepares the final representation of the data required by DataTables.
     * totalRecords is the total number of records after the server is done filtering,
     * but we are currently not doing any server-side filtering so it is equivalent to the total.
     * @private
     * @method _prepareData
     * @param {Object} tableParams Parameters for the ajax request to retrieve the desired data
     * @param {Object} result The result of the server retrieval; null if there was an error
     * @return {Object} Returns the processed data
     */
    _prepareData : function(tableParams, result) {
      var translatedData = [];
      var totalRecords = 0;

      if (result) {
        translatedData = this._translateData(result.list);
        totalRecords = result.fullListSize;
      }

      return {
        'draw': parseInt(tableParams.draw),
        'recordsTotal': totalRecords,
        'recordsFiltered': totalRecords,
        'data': translatedData
      };
    },


    /*
     * Translates the entries that exist within the collection that have ids corresponding to ids in the given list.
     *
     * We need to translate the collection of objects that Torso will retrieve into a format that DataTables expects.
     * Instead of an array of objects with properties, DataTables requires an array of (object of objects) where the
     * (object of objects) is the equivalent to the model object containing properties. ColReorder requires the keys
     * of the objects to be the identifiers of the columns.
     *
     * Note that we are doing idListOrder.map(). This allows us to use the variable we set aside that contained the
     * correct list order and preserve that ordering for our final data representation.
     *
     * @private
     * @method _translateData
     * @param {Number[]} idListOrder An array of longs with the ids of the objects to add in the desired order.
     * @return {Object[]} modelAsObject Returns the translated column information
     */
    _translateData: function(idListOrder) {
      var columnConfigs = this._initializeAndGetColumnConfig();
      return _.compact(idListOrder.map(function(modelId) {
        var model = this.collection.get(modelId);

        // DataTables can not handle empty or null objects in the object list.
        // Therefore, we should default to returning null if model does not exist and then filter those values out with compact.
        var modelAsObject = null;
        if (model) {
          // The ordering here is very important as it determines the ordering of cells in each table row.
          // Table cells will be placed from left to right in the same order as the attributes listed here.
          modelAsObject = {};
          for (var i = 0; i < columnConfigs.length; i++) {
            var columnConfig = columnConfigs[i];
            var data = model.get(columnConfig.label) || '';
            if (_.isString(data)) {
              // Utilize handlebars helpers to escape the html if the data is a string.
              data =  Handlebars.Utils.escapeExpression(model.get(columnConfig.label));
            }
            modelAsObject[columnConfig.options.name] = data;
          }
        }
        return modelAsObject;
      }, this));
    }

  });

  return brecView;
}));
