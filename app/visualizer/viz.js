'use strict';

var mainApp = angular.module('SpeedRacerViz.viz', []);

mainApp.factory('sharedService', ['$stompie', '$rootScope', function($stompie, $rootScope) {
    var sharedService = {};

    sharedService.message = '';

    $stompie.using('http://localhost:8089/messages', function () {

      var subscription = $stompie.subscribe('/topic/simulator/news', function (msg) {

          // Save data point for visualisation (just the gyro value)
          sharedService.prepForBroadcast( msg );
      });
    });

    sharedService.prepForBroadcast = function(msg) {
        this.message = msg;
        this.propagateEvent();
    };

    sharedService.propagateEvent = function() {
        $rootScope.$broadcast('receivedSensorEvent');
    };

    return sharedService;
}]);

mainApp.controller('GyroGraphController', ['$scope', 'sharedService', '$window', function($scope, sharedService, $window) {
    $scope.gyroColor = '#00ff00';

    var gridDef = {
            fillStyle:'rgba(0,0,0,0.40)',
            sharpLines: true,
            millisPerLine: 2000,
            verticalSections: 8
        },
        smoothieGyro = new SmoothieChart({
            millisPerPixel: 20,
            labels:{ fontSize:14, precision:0 },
            grid: gridDef,
            timestampFormatter: SmoothieChart.timeFormatter,
            maxValue: 10000,
            minValue: -10000
        }),
        gyroZ = new TimeSeries();

    $scope.$on('receivedSensorEvent', function() {
        var t = new Date().getTime();
        gyroZ.append( t, sharedService.message.event['g'][2] );

    });

    // handle resizing --> adjust the canvas' width accordingly
    $scope.width = 600;
    $scope.$watch(function(){
      return $window.innerWidth;
    }, function(value) {
      $scope.width = value;
    });

    smoothieGyro.addTimeSeries(gyroZ, { strokeStyle: $scope.gyroColor, lineWidth:3 } );

    smoothieGyro.streamTo(document.getElementById("gyroCanvas"));
}]);

mainApp.controller('SpeedPowerGraphController', ['$scope', 'sharedService', '$window', function($scope, sharedService, $window) {
    $scope.powerColor = '#ff0000';
    $scope.speedColor = '#0000ff';

    var gridDef = {
            fillStyle:'rgba(0,0,0,0.40)',
            sharpLines: true,
            millisPerLine: 2000,
            verticalSections: 8
        },
        smoothieSpeed = new SmoothieChart({
            interpolation:'linear',
            millisPerPixel: 20,
            labels:{ fontSize:14, precision:0 },
            grid: gridDef,
            timestampFormatter: SmoothieChart.timeFormatter,
            maxValue: 350,
            minValue: 0
        }),
        power = new TimeSeries(),
        speed = new TimeSeries(),
        lastSpeed = -1;

    // handle resizing --> adjust the canvas' width accordingly
    $scope.width = 600;
    $scope.$watch(function(){
      return $window.innerWidth;
    }, function(value) {
      $scope.width = value;
    });

    // Add to SmoothieChart
    smoothieSpeed.addTimeSeries(power, { strokeStyle: $scope.powerColor , lineWidth:3 } );
    smoothieSpeed.addTimeSeries(speed, { strokeStyle: $scope.speedColor, lineWidth:3 } );


    $scope.$on('receivedSensorEvent', function() {
        var t = new Date().getTime();
        power.append( t, sharedService.message.currentPower );

        // only log speed if it actually changed
        if ( sharedService.message.velocity != lastSpeed ) {
            speed.append( t, sharedService.message.velocity );
            lastSpeed = sharedService.message.velocity;
        }
    });

    smoothieSpeed.streamTo(document.getElementById("speedCanvas"));

}]);

mainApp.controller('RoundTimesGraphController', ['$scope', 'sharedService', '$window', function($scope, sharedService, $window) {
    $scope.currentRound = 0;

    $scope.lowestRoundTime = -1;

    var roundTimeChart = new CanvasJS.Chart("roundTimesContainer", {
            data: [{
              type: "spline",
              dataPoints: []
            }]
        }),
        raceStart = Date.now(),
        fiveMinutesReached = false,
        timeLabelSet = false,
        calcLowest = function( points ) {
            var size = points.length,
                lowest = Number.MAX_VALUE,
                lowestIndex;

            // start at second data point because first round time is usually unusable
            for( var i = 0; i < size; i++ ) {
              var rt = points[i].y;
              if ( rt < lowest ) {
                lowest = rt;
                lowestIndex = i;
              }
            }

            _.extend( points[lowestIndex], {
                indexLabel: "Lowest",
                markerType: "triangle",
                markerColor: "#6B8E23",
                markerSize: 12
            });

            $scope.lowestRoundTime = lowest;
        },
        saveData = function( msg ) {
            var t = new Date().getTime();

            if ( msg.roundNumber > $scope.currentRound ) {

                var roundTime = Math.abs( $scope.lastTime - msg.event.timeStamp );
                var entry = { y: roundTime };

                $scope.lastTime = msg.event.timeStamp;
                $scope.currentRound = msg.roundNumber;

                if ( !timeLabelSet && !fiveMinutesReached && msg.event.timeStamp - raceStart >= 1000*60*5 ) {
                  fiveMinutesReached = false;
                  timeLabelSet = true;

                  _.extend( entry, {
                      indexLabel: "Time over",
                      markerType: "cross",
                      markerColor: "red",
                      markerSize: 12
                  });
                }

                // add newest roundTime to 3rd graph
                roundTimeChart.options.data[0].dataPoints.push( entry );

                calcLowest( roundTimeChart.options.data[0].dataPoints );

                roundTimeChart.render();
            }
        };


    $scope.$on('receivedSensorEvent', function() {
        saveData(sharedService.message);
    });

    roundTimeChart.render();
}]);

mainApp.controller('vizCtrl', ['$scope', '$stompie', '$window', function($scope, $stompie, $window) {

    $scope.lastTime;
    $scope.currentRound = 0;

    $scope.isRunning = true;
    $scope.pause = function() {
      if ( $scope.isRunning )  {
        smoothieGyro.stop();
        smoothieSpeed.stop();
      } else {
        smoothieGyro.start();
        smoothieSpeed.start();
      }
      $scope.isRunning = !$scope.isRunning;
    }

    $scope.stop = function() {
      // Disconnect from the socket.
      $stompie.disconnect(function () {
          // Called once you're out...
      });
    };

    $scope.start = function() {
      /*
      $stompie.using('http://localhost:8089/messages', function () {

        // The $scope bindings are updated for you so no need to $scope.$apply.
        // The subscription object is returned by the method.
        var subscription = $stompie.subscribe('/topic/simulator/news', function (msg) {

            // Save data point for visualisation (just the gyro value)
            saveData( msg );
        });
      });
      */
    };

    $scope.start();
}]);
