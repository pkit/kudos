if (Meteor.isClient) {
    Template.listkudos.helpers({
        selectedPerson: function() {
            return Session.get('selectedPerson');
        }
    });
}

var ldap = Meteor.npmRequire('ldapjs');
var client = ldap.createClient({
    url:Meteor.settings.url
});

var syncLdapClient = {
    bind: Async.wrap(client, 'bind'),
    search: Async.wrap(client, 'search'),
    unbind: Async.wrap(client, 'unbind')
};

function syncUsers() {
    try {
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
            assert.ifError(err);
        }));

        results.on('end', Meteor.bindEnvironment(function (res) {
            Log.info('LDAP done: ' + count);
            syncLdapClient.unbind();
            done = true;
        }));

        setTimeout(syncUsers, 3 * 60 * 60 * 1000);
    } catch (err) {
        Log.err(err);
    }
}

if (Meteor.isServer) {
    Meteor.methods({
        'syncUsers': syncUsers
    });
    syncUsers();
}