'use strict';

var mainApp = angular.module('SpeedRacerViz.viz', []);

mainApp.factory('sharedService', ['$stompie', '$rootScope', function($stompie, $rootScope) {
    var sharedService = {};

    sharedService.message = '';

    sharedService.isRunning = true;


    sharedService.prepForBroadcast = function(msg) {
        this.message = msg;
        this.propagateEvent();
    };

    sharedService.propagateEvent = function() {
        $rootScope.$broadcast('receivedSensorEvent');
    };

    sharedService.stop = function() {
      // Disconnect from the socket.
      $stompie.disconnect(function () {
          // Called once we're out...
      });
    };

    sharedService.start = function() {
      $stompie.using('http://localhost:8089/messages', function () {
        var subscription = $stompie.subscribe('/topic/simulator/news', function (msg) {
            // propagate the events to all controllers
            sharedService.prepForBroadcast( msg );
        });
      });
    };

    sharedService.pause = function() {
      this.isRunning = !this.isRunning;
      $rootScope.$broadcast('simulationEvent');
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

    $scope.$on('simulationEvent', function() {
        if( sharedService.isRunning ) {
            smoothieGyro.start();
        } else {
            smoothieGyro.stop();
        }
    });

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

    $scope.$on('simulationEvent', function() {
        if( sharedService.isRunning ) {
            smoothieSpeed.start();
        } else {
            smoothieSpeed.stop();
        }
    });

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
        currentRound = 0,
        lowestIndexSoFar = -1,
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

            // remove previous lowest point if new lowest point was found
            if ( lowestIndexSoFar >= 0 ) {
                _.extend( points[lowestIndexSoFar], {
                    indexLabel: "",
                    markerType: "circle",
                    markerColor: "",
                    markerSize: 8
                });
            }
            lowestIndexSoFar = lowestIndex;

            _.extend( points[lowestIndex], {
                indexLabel: "Lowest",
                markerType: "triangle",
                markerColor: "green",
                markerSize: 12
            });

            $scope.lowestRoundTime = lowest;
        },
        saveData = function( msg ) {
            var t = new Date().getTime();

            // simple way the figure out round change
            if ( msg.roundNumber > currentRound ) {
                currentRound = msg.roundNumber;

                var roundTime = Math.abs( $scope.lastTime - msg.event.timeStamp );
                var entry = { y: roundTime };

                $scope.lastTime = msg.event.timeStamp;

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

                if ( sharedService.isRunning ) {
                    roundTimeChart.render();
                }
            }
        };


    $scope.$on('receivedSensorEvent', function() {
        saveData(sharedService.message);
    });

    roundTimeChart.render();
}]);

mainApp.controller('InputController', ['$scope', 'sharedService', '$stompie', '$window', function($scope, sharedService, $stompie, $window) {
    $scope.isRunning = true;
    $scope.currentRound = 0;

    $scope.$on('simulationEvent', function() {
      $scope.isRunning = sharedService.isRunning;
    });

    $scope.$on('receivedSensorEvent', function() {
        $scope.currentRound = sharedService.message.roundNumber;
    });

    $scope.pause = function() { sharedService.pause(); };
    $scope.stop = function() {  sharedService.stop(); };
    $scope.start = function() { sharedService.start(); };

    $scope.start();
}]);
