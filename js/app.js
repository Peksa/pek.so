var pekso = angular.module('pekso', []);

pekso.service('$config', function() {
    console.log("Creating config service");
    this.fbAppId = '602729056487961';
    this.awsS3Bucket = 'pek.so';
    this.awsWebIdentityRole = 'arn:aws:iam::507606061091:role/pek.so';
    this.awsRegion = 'eu-west-1';
});

pekso.factory('$fb', function($config) {
    console.log("Creating fb factory");
    return {
        init: function() {
            console.log("FB init called");
            FB.init({
                appId: $config.fbAppId,
                status: false,
                cookie: true,
                xfbml: false
            });
        },
        login: function() {
            console.log("FB login called");
            FB.login();
        },
        onLogin: function(callback) {
            FB.Event.subscribe('auth.authResponseChange', function(response) {
                console.log("FB change state to: " + response.status);
                if (response.status === 'connected') {
                    callback(null, response.authResponse.accessToken);
                } else {
                    callback(response.status, null);
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
            AWS.config.credentials = new AWS.WebIdentityCredentials({
                RoleArn: $config.awsWebIdentityRole,
                ProviderId: 'graph.facebook.com',
                WebIdentityToken: accessToken
            });
            AWS.config.region = $config.awsRegion;
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
    return {
        init: function(callback) {
            $fb.init();
            $fb.login();
            $fb.onLogin(function(err, accessToken) {
                if (err) {
                    callback("Error with FB-login: " + err);
                } else {
                    $aws.init(accessToken);
                    callback(undefined, "success");
                }
            });
        },
        list: function(callback) {
            $aws.s3().listObjects(function(err, response) {
                if (err) {  callback(err); return; }

                var requests = [];
                var remaining = response.Contents.length;

                for (var i in response.Contents) {
                    var key = response.Contents[i].Key;
                    $aws.s3().getObject({ Key: key }, function(err, response) {
                        requests.push({key: this.request.params.Key, url: response.WebsiteRedirectLocation});
                        --remaining;
                        if (remaining <= 0) {
                            callback(null, requests);
                        }
                    });
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



function PeksoCtrl($pekso, $scope) {

    $scope.login = function() {
        $scope.loggedIn = true;

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
    };

    $scope.logout = function() {
        $scope.loggedIn = false;
    };

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
        for (var i=0; i < 3; i++) {
            var rnum = Math.floor(Math.random() * chars.length);
            ret += chars[rnum];
        }
        $scope.newKey = ret;
    };

    $scope.random();
}




