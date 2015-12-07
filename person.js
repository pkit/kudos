if (Meteor.isClient) {
    Template.listkudos.helpers({
        selectedPerson: function() {
            return Session.get('selectedPerson');
        }
    });
/*
    Template.kudos.helpers({
        fullName: function() {
            var data = users.findOne({_id:this.to});
            return "text";//data.firstName + " " + data.lastName;
        }
    })
*/
}

function syncUsers() {
    if (rackUsers.find().count() !== 0)
        return;

    var ldap = Meteor.npmRequire('ldapjs');
    var client = ldap.createClient({
        url:Meteor.settings.url,
    });

    var user = Meteor.settings.user;
    var passwd = Meteor.settings.passwd;

    var bindSync = Async.wrap(client, 'bind');
    bindSync(user, passwd);


    var base = Meteor.settings.base;
    var opts = {
        filter:Meteor.settings.filter,
        scope:Meteor.settings.scope,
        attributes: ['dn', 'cn', 'title', 'sn', 'givenName', 'Division', 'manager', 'displayName', 'photo', 'uid', 'mail'],
        timeLimit: 60
    };


    var searchSync = Async.wrap(client, 'search');
    var results = searchSync(base, opts);

    results.on('searchEntry', Meteor.bindEnvironment(function(entry) {
        rackUsers.insert({
            'uid':entry.object.uid,
            'email':entry.object.mail.toLowerCase(),
            'firstName': entry.object.givenName,
            'lastName': entry.object.sn,
            'fullName': entry.object.displayName,
            'title': entry.object.title,
            'photo': entry.raw.photo.toString('base64'),
            'department': entry.object.Division
        });
    }));
    results.on('error', function(err) {
    });

    results.on('end', function(){
    })
};

if (Meteor.isServer) {
    Meteor.methods({
        'syncUsers': syncUsers
    });
}