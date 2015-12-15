if (Meteor.isClient) {
    Template.listkudos.helpers({
        selectedPerson: function() {
            return Session.get('selectedPerson');
        }
    });
}

if (Meteor.isServer) {
    var ldap = Meteor.npmRequire('ldapjs');

    var client;
    function syncUsers() {
        try {
            client = ldap.createClient({
                url:Meteor.settings.url
            });

            var syncLdapClient = {
                bind: Async.wrap(client, 'bind'),
                search: Async.wrap(client, 'search'),
                unbind: Async.wrap(client, 'unbind')
            };

            var user = Meteor.settings.user;
            var passwd = Meteor.settings.passwd;

            syncLdapClient.bind(user, passwd);

            var base = Meteor.settings.base;
            var opts = {
                filter: Meteor.settings.filter,
                scope: Meteor.settings.scope,
                attributes: ['dn', 'cn', 'title', 'sn', 'givenName',
                    'Division', 'manager', 'displayName', 'photo', 'uid', 'mail'],
                timeLimit: 120,
                paged: true
            };

            var results = syncLdapClient.search(base, opts);
            var count = 0;
            var done = false;

            results.on('searchEntry', Meteor.bindEnvironment(function (entry) {
                var user = {
                    'uid': entry.object.uid,
                    'email': entry.object.mail.toLowerCase(),
                    'firstName': entry.object.givenName,
                    'lastName': entry.object.sn,
                    'fullName': entry.object.displayName,
                    'title': entry.object.title,
                    'photo': entry.raw.photo.toString('base64'),
                    'department': entry.object.Division
                };
                rackUsers.upsert({email: user.email}, {$set: user}, function() {});
                count++;
            }));

            results.on('error', Meteor.bindEnvironment(function (err) {
                Log.error(err);
            }));

            results.on('end', Meteor.bindEnvironment(function (res) {
                Log.info('LDAP done: ' + count);
                syncLdapClient.unbind();
                client.destroy();
                done = true;
            }));
        } catch (err) {
            Log.error(err);
            if (client) {
                client.destroy();
                client = null;
            }
        }
        setTimeout(syncUsers, 3 * 60 * 60 * 1000);
    }

    function syncFromFile() {
        try {
            Assets.getText('ldap.json', function (err, res) {
                if (err) {
                    Log.error(err);
                } else {
                    var result = JSON.parse(res);
                    var len = result.length;
                    for (var i = 0; i < len; i++) {
                        var user = {
                            'uid': result[i].uid,
                            'email': result[i].mail.toLowerCase(),
                            'firstName': result[i].givenName,
                            'lastName': result[i].sn,
                            'fullName': result[i].displayName,
                            'title': result[i].title,
                            'photo': result[i].photo,
                            'department': result[i].Division
                        };
                        rackUsers.upsert({email: user.email}, {$set: user}, function() {});
                    }
                    Log.info('Loaded ' + len + ' entries from ldap.json');
                    result = null;
                }
            });
        } catch (err) {
            Log.error(err);
        }
        setTimeout(syncFromFile, 3 * 60 * 60 * 1000);
    }

    Meteor.methods({
        'syncUsers': syncUsers,
        'syncFromFile': syncFromFile
    });
    syncUsers();
}
