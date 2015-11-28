'use strict';

angular.module('myApp.view1', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])

.controller('View1Ctrl', ['$scope', '$stompie', function($scope, $stompie) {
  var window = [],
      windowSize = 10,
      smoothingThreshold = 60,
      originalDataPoints = {
          type: "line",
          name: "Original",
          showInLegend: true,
          dataPoints: [{y: 0}]
      },
      filteredDataPoints = {
          type: "line",
          name: "Filtered",
          showInLegend: true,
          dataPoints: [{y: 0}]
      },
      interpretedDataPoints = {
          type: "line",
          name: "Interpreted",
          showInLegend: true,
          dataPoints: [{y: 0}]
      },
      chart = new CanvasJS.Chart("chartContainer", {
          zoomEnabled: true,
          data: [ originalDataPoints, filteredDataPoints, interpretedDataPoints ]
      }),
      maxEntries = 100;

    $scope.showGraph = true;
    $scope.selectedSpec = {description: 'Gyro Z', coord: { vector: 'g', axis: 2 },
            range: { lower: -8000, upper: 8000}};

    var saveData = function( dataPoint ) {
      var y = dataPoint.y;

      originalDataPoints.dataPoints.push( { y: y } );

      if ( window.length >= windowSize ) {
          window.splice(0,1);
      }
      window.push( y );

      var winAVG = 0;

      for( var i = 0; i < window.length; i++ ) {
          winAVG += window[i];
      }
      winAVG /= window.length;

      if ( Math.abs( y - winAVG ) > smoothingThreshold ) {
          y = winAVG;
      }

      filteredDataPoints.dataPoints.push( { y: y } );

      if ( y < -400 ) {
          y = -4000;
      } else if ( y > 400 ) {
          y = 4000;
      } else {
          y = 0;
      }

      interpretedDataPoints.dataPoints.push( { y: y } );

      // have a max. number of values
      /*
      if (originalDataPoints.dataPoints.length > maxEntries ) {
          originalDataPoints.dataPoints.shift();
          filteredDataPoints.dataPoints.shift();
          interpretedDataPoints.dataPoints.shift();
      }
      */
    };

    $scope.toggleGraph = function() {
        $scope.showGraph = !$scope.showGraph;
    };
    $scope.drawGraph = function() {
        chart.render();
    };

    $scope.stop = function() {
      // Disconnect from the socket.
      $stompie.disconnect(function () {
          // Called once you're out...
      });
    };

    $scope.start = function() {
        $stompie.using('http://localhost:8089/messages', function () {

            // The $scope bindings are updated for you so no need to $scope.$apply.
            // The subscription object is returned by the method.
            var subscription = $stompie.subscribe('/topic/simulator/news', function (msg) {

                // Save data point for visualisation (just the gyro value)
                saveData( {y: msg.event[$scope.selectedSpec.coord.vector][$scope.selectedSpec.coord.axis] } );

                $scope.drawGraph();
            });

            // Unsubscribe using said subscription object.
            //subscription.unsubscribe();
          });

      };

      $scope.start();
}]);
