/**
 * @license
 * Copyright 2015 The Lovefield Project Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
goog.provide('lf.query.Context');

goog.require('goog.asserts');
goog.require('goog.structs.Map');
goog.require('goog.structs.Set');
goog.require('lf.pred.ValuePredicate');



/**
 * Base context for all query types.
 * @constructor
 * @param {!lf.schema.Database} schema
 */
lf.query.Context = function(schema) {
  /** @protected {!lf.schema.Database} */
  this.schema = schema;

  /**
   * A map used for locating predicates by ID. Instantiated lazily.
   * @private {?goog.structs.Map<number, !lf.Predicate>}
   */
  this.predicateMap_ = null;

  /** @type {!lf.Predicate} */
  this.where;

  /** @type {?lf.query.Context} */
  this.clonedFrom = null;
};


/**
 * @param {number} id
 * @return {!lf.Predicate}
 */
lf.query.Context.prototype.getPredicate = function(id) {
  if (goog.isNull(this.predicateMap_) && goog.isDefAndNotNull(this.where)) {
    this.predicateMap_ = lf.query.Context.buildPredicateMap_(
        /** @type {!lf.pred.PredicateNode} */ (this.where));
  }

  var predicate = this.predicateMap_.get(id, null);
  goog.asserts.assert(!goog.isNull(predicate));
  return predicate;
};


/**
 * Creates predicateMap such that predicates can be located by ID.
 * @param {!lf.pred.PredicateNode} rootPredicate The root of the predicate tree.
 * @return {!goog.structs.Map<number, !lf.Predicate>}
 * @private
 */
lf.query.Context.buildPredicateMap_ = function(rootPredicate) {
  var predicateMap = new goog.structs.Map();
  rootPredicate.traverse(function(node) {
    predicateMap.set(node.getId(), /** @type {!lf.Predicate} */ (node));
  });
  return predicateMap;
};


/** @return {!goog.structs.Set<!lf.schema.Table>} */
lf.query.Context.prototype.getScope = goog.abstractMethod;


/** @return {!lf.query.Context} */
lf.query.Context.prototype.clone = goog.abstractMethod;


/**
 * @param {!lf.query.Context} context
 * @protected
 */
lf.query.Context.prototype.cloneBase = function(context) {
  if (context.where) {
    this.where = context.where.copy();
  }
  this.clonedFrom = context;
};


/**
 * Expands the scope of a query to the parent tables to which
 * each table in the current scope have a foreign key.
 * @param {!goog.structs.Set<!lf.schema.Table>} originalScope
 * @param {!goog.structs.Set<!lf.schema.Column>=} opt_columns
 * @return {!goog.structs.Set<!lf.schema.Table>}
 * @protected
 */
lf.query.Context.prototype.expandParentScope = function(originalScope,
    opt_columns) {
  var extraScope = new goog.structs.Set();

  originalScope.getValues().forEach(
      function(table) {
        var foreignKeys = table.getConstraint().getForeignKeys();
        foreignKeys.forEach(
            function(foreignKey) {
              if ((opt_columns &&
                  !opt_columns.contains(table[foreignKey.childColumn]))) {
                return;
              }
              var parentTable = this.schema.table(foreignKey.parentTable);
              extraScope.add(parentTable);
            }, this);
      }, this);

  return extraScope;
};


/**
 * Expands the scope of a query to the children tables which
 * have foreign keys to each table in the current scope.
 * @param {!goog.structs.Set<!lf.schema.Table>} originalScope
 * @param {!goog.structs.Set<!lf.schema.Column>=} opt_columns
 * @return {!goog.structs.Set<!lf.schema.Table>}
 * @protected
 */
lf.query.Context.prototype.expandChildrenScope = function(originalScope,
    opt_columns) {
  var extraScope = new goog.structs.Set();

  originalScope.getValues().forEach(
      function(table) {
        var columns = table.getColumns();
        columns.forEach(
            function(column) {
              if ((opt_columns && !opt_columns.contains(column)) ||
                  goog.isNull(column.getChildren())) {
                return;
              }
              column.getChildren().forEach(function(child) {
                extraScope.add(child.getTable());
              },this);
            }, this);
      }, this);

  return extraScope;
};


/**
 * @param {!Array<*>} values
 * @return {!lf.query.Context}
 */
lf.query.Context.prototype.bind = function(values) {
  goog.asserts.assert(!goog.isDefAndNotNull(this.clonedFrom));
  return this;
};


/**
 * @param {!Array<*>} values
 */
lf.query.Context.prototype.bindValuesInSearchCondition = function(values) {
  var searchCondition =
      /** @type {?lf.pred.PredicateNode} */ (this.where);
  if (goog.isDefAndNotNull(searchCondition)) {
    searchCondition.traverse(function(node) {
      if (node instanceof lf.pred.ValuePredicate) {
        node.bind(values);
      }
    });
  }
};
