'use strict';

// Declare app level module which depends on views, and components
angular.module('myApp', [
  'myApp.viz',
  'stompie'
]).
config(['$routeProvider', function($routeProvider) {
  $routeProvider.otherwise({redirectTo: '/visualizer'});
}]);
