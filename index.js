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
      'restore': "Restore",
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


    // ----- Overrides -------------------------------------------------------------------------------------------------------------

    /**
     * @method initialize
     * @override
     */
    initialize: function() {
      this.columnConfig = this.columnInit();
    },

    /**
     * Construct any additional resources when the view is attached to the DOM.
     * Currently this is used to initialize javascript widgets that affect the display.
     * @method _attached
     * @override
     */
    _attached: function() {

      // Activate BREC event listeners
      this.on('successServerRetrieval', this.successfulServerRetrieval);
      this.on('errorServerRetrieval', this.errorServerRetrieval);

      this._brecTableInit();
      this._brecWidgetsInit();
    },

    /**
     * Destroy any additional resources when the view is removed from the DOM.
     * Currently this is used to remove javascript widgets that affect the display.
     * @method _detached
     * @override
     */
    _detached: function() {

      // Deactivate BREC event listeners
      this.off('successServerRetrieval');
      this.off('errorServerRetrieval');

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
      };

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
      $(window).on('resize.updateFixedHeaderPosition', this._updateFixedHeaderPos.bind(this));

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
      this.tableHeader._fnUpdateClones(true);
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
        'dom': view.tableControls,
        'stateSave': true,
        'serverSide': true,
        'responsive': view.responsiveTable || false,
        'ajax': view._requestData.bind(view),
        'fnStateLoadCallback': function() {
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
        'fnStateSaveCallback': function ( settings, data ) {
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
        'columns': _.map(this.columnConfig, function(column){return column.options;})
      }, view.tableOptionsExtensions));
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

      $.ajax({
        url: this.url,
        method: 'POST',
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        data: JSON.stringify(tableParams),
        context: this,
      }).done(function(result) {
        var view = this;
        this.trigger('successServerRetrieval');

        this.collection.trackAndFetch(result.list).then(function() {
          callback(view._prepareData(tableParams, result));
          view._updateFixedHeaderPos();
        });
      }).fail(function() {
        this.trigger('errorServerRetrieval');

        callback(this._prepareData(tableParams));
        view._updateFixedHeaderPos();
      });
    },


    // ----- Helpers ---------------------------------------------------------------------------------------------------------------

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
      var columnInfo = _.map(this.columnInit(), function(column){return column.label;});
      return _.compact(idListOrder.map(function(modelId) {
        var model = this.collection.get(modelId);

        // DataTables can not handle empty or null objects in the object list.
        // Therefore, we should default to returning null if model does not exist and then filter those values out with compact.
        var modelAsObject = null;
        if (model) {
          // The ordering here is very important as it determines the ordering of cells in each table row.
          // Table cells will be placed from left to right in the same order as the attributes listed here.
          modelAsObject = {};
          for (var i=0; i<columnInfo.length; i++) {
            // Utilize handlebars helpers to escape the html
            modelAsObject[columnInfo[i]] = Handlebars.Utils.escapeExpression(model.get(columnInfo[i]));
          }
        }
        return modelAsObject;
      }, this));
    }

  });

  return brecView;
}));
