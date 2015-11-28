var pekso = angular.module('pekso', ['ngRoute']);

pekso.service('$config', function() {
    console.log("Creating config service");
    this.fbAppId = '602729056487961';
    this.awsS3Bucket = 'pek.so';
    this.awsWebIdentityRole = 'arn:aws:iam::507606061091:role/pek.so';
    this.awsRegion = 'eu-west-1';
    this.domain = 'http://pek.so'; // avoid trailing slash
});

pekso.config(function($routeProvider, $locationProvider) {
    console.log("Creating pekso config");
    $routeProvider.when('/', {
        templateUrl: 'main.html',
        controller: MainCntl
    });
    $routeProvider.when('/admin', {
        templateUrl: 'admin.html',
        controller: AdminCntl
    });
    $routeProvider.otherwise({
        redirectTo: '/'
    })
    $locationProvider.html5Mode(true);
});

pekso.factory('$fb', function($config) {
    console.log("Creating fb factory")

    FB.init({
        appId: $config.fbAppId,
        status: false,
        cookie: true,
        xfbml: false
    });

    return {
        getLoginStatus: function(callback) {
            FB.getLoginStatus(callback);
        },
        getAccessToken: function(callback) {
            this.getLoginStatus(function(response) {
                if (response.status === 'connected') {
                    callback(null, response.authResponse.accessToken);
                } else {
                    FB.login(function(response) {
                        console.log("FB change state to: " + response.status);
                        if (response.status === 'connected') {
                            callback(null, response.authResponse.accessToken);
                        } else {
                            callback(response.status, null);
                        }
                    });
                }
            });
        }
    };
});

pekso.factory('$aws', function($config) {
    console.log("Creating aws factory");
    return {
        initialized: false,
        bucket: undefined,
        init: function(accessToken) {
            if (this.initialized) {
                return;
            }
            AWS.config.region = $config.awsRegion;
            AWS.config.update({
                credentials: new AWS.WebIdentityCredentials({
                    RoleArn: $config.awsWebIdentityRole,
                    ProviderId: 'graph.facebook.com',
                    WebIdentityToken: accessToken
                })
            });
            this.initialized = true;
        },
        s3: function() {
            if (this.bucket) {
                return this.bucket;
            }
            this.bucket = new AWS.S3({params: {Bucket: $config.awsS3Bucket}});
            return this.bucket;
        }
    }
});

pekso.factory('$pekso', function($fb, $aws) {
    console.log("Creating pekso factory");

    var loggedIn = false;
    var self = this;

    return {
        init: function(callback) {
            $fb.getAccessToken(function(err, accessToken) {
                if (err) {
                    callback("Error with FB-login: " + err);
                } else {
                    $aws.init(accessToken);
                    callback(null, "success");
                }
            });
        },
        isLoggedIn: function() {
            return self.loggedIn;
        },
        login: function() {
            self.loggedIn = true;
        },
        logout: function() {
            self.loggedIn = false;
        },
        list: function(callback) {
            $aws.s3().listObjects(function(err, response) {
                if (err) {  callback(err); return; }

                var requests = [];
                var remaining = response.Contents.length;

                for (var i in response.Contents) {
                    var key = response.Contents[i].Key;

                    if (key.indexOf('.') !== -1 || key.indexOf('/') !== -1) {
                        --remaining;
                        if (remaining <= 0) {
                            callback(null, requests);
                        }
                        continue;
                    } else {
                        $aws.s3().headObject({ Key: key }, function(err, response) {
                            if (response.WebsiteRedirectLocation) {
                                requests.push({key: this.request.params.Key, url: response.WebsiteRedirectLocation});
                            }
                            --remaining;
                            if (remaining <= 0) {
                                callback(null, requests);
                            }
                        });
                    }
                }
            });
        },
        create: function(key, url, callback) {
            console.log("Creating new redirect from /" + key + " to: " + url);
            $aws.s3().putObject({
                Key: key,
                WebsiteRedirectLocation: url
            }, callback);
        },
        remove: function(key, callback) {
            console.log("Removing redirect: " + key);
            $aws.s3().deleteObject({
               Key: key
            }, callback);
        }
    }
});

function MainCntl($scope, $pekso, $fb, $location) {
    console.log("Main controller!");

    // Check if already logged in to FB.
    if (!$pekso.isLoggedIn()) {
        $fb.getLoginStatus(function(response) {
            console.log("FB STATUS ON LOAD: " + response.status);
            if (response.status === 'connected') {
                console.log("Already FB logged in, sending to /admin")
                $pekso.login();
                $scope.$apply(function() {
                    $location.path('/admin');
                });
            }
        });
    }

    $scope.login = function() {
        console.log("login");
        $fb.getAccessToken(function(err, accessToken) {
            if (accessToken) {
                console.log("Logged in, sending to /admin")
                $pekso.login();
                if(!$scope.$$phase) {
                    $scope.$apply(function() {
                        $location.path('/admin');
                    })
                } else {
                    $location.path('/admin');
                }

            } else {
                alert("Error! :( " + err);
            }
        })
    };
}


function AdminCntl($scope, $pekso, $location, $config) {
    console.log("Admin controller!");

    $scope.domain = $config.domain;

    if (!$pekso.isLoggedIn()) {
        $location.path('/');
    }

    $scope.logout = function() {
        $location.path('/');
    };

    $pekso.init(function(err) {
        if (err) {
            $scope.err = err;
            return;
        }

        $pekso.list(function(err, data) {
            if (err) {
                $scope.err = "Oh snap, " + err;
            } else {
                $scope.urls = data;
                $scope.err = undefined;
            }
            $scope.$apply();
        });

    });

    $scope.create = function() {
        $scope.sending = true;
        $pekso.create($scope.newKey, $scope.newUrl, function(err) {
            if (err) { $scope.err = err; return; }
            $scope.urls.push({key: $scope.newKey, url: $scope.newUrl});
            $scope.newKey = undefined;
            $scope.newUrl = undefined;
            $scope.sending = false;
            $scope.$apply();
        });
    };

    $scope.remove = function(row) {
        $pekso.remove(row.key, function(err) {
            if (err) { $scope.err = err; return; }
            $scope.urls.splice(this.$index, 1);
            $scope.$apply();
        });
    };

    $scope.random = function() {
        var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
        var ret = "";
        for (var i = 0; i < 3; i++) {
            var rnum = Math.floor(Math.random() * chars.length);
            ret += chars[rnum];
        }
        $scope.newKey = ret;
    };

    $scope.random();
}

