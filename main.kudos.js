var kudosIncrement = 5;

function getKudosList(personSelected){
    var kudosLimit = Session.get("itemsLimit");
    if (personSelected == null){
        return kudos.find({}, { limit : kudosLimit, sort: {date: 1}});
    }
    else {
        return kudos.find({to:personSelected.email}, { limit : kudosLimit, sort: {date: 1}});
    }
}

function getKudosCount(personSelected){
    if (personSelected == null){
        return kudos.find({}).count();
    }
    else {
        return kudos.find({to:personSelected.email}).count();
    }
}

function showMoreVisible() {
    var kudosCount = getKudosCount(Session.get('selectedPerson'));

    if (kudosCount>Session.get("itemsLimit")){
        Session.set("itemsLimit", Session.get("itemsLimit") + kudosIncrement);
    }
}

if (Meteor.isClient) {

    Session.setDefault('itemsLimit', kudosIncrement);

    Meteor.subscribe('userData');

    Session.set('showComments',false);
    Session.set('buttonId','');

    Template.registerHelper( 'equals', function (a,b){
        return a===b;
    } );
    Template.registerHelper('formatDate', function(date) {
        var d = new Date(date);
        var m = "0" + (parseInt(d.getMonth()) + 1);
        return d.getDate() + "-" + m.substr(m.length-2) + "-" + d.getFullYear();
    });

    Template.mediaItems.created = function () {
        Meteor.subscribe('kudos', Session.get('selectedPerson'), Session.get("itemsLimit"));
    };

    Template.mediaItems.helpers({
        "media_obj":function(){
            return getKudosList(Session.get('selectedPerson'));
        },
        "kudosTitle":function(){
            var selectedPerson = Session.get('selectedPerson');
            var kudoslist = getKudosList(selectedPerson);
            if (selectedPerson == null){
                if (kudoslist.count() == 0)
                    return "There is no kudos";
                else
                    return "Latest kudos";
            }
            else{
                if (kudoslist.count() == 0)
                    return "There is no kudos for " + selectedPerson.fullName + ". You can leave the first kudos!";
                else
                    return "Latest kudos for " + selectedPerson.fullName;
            }
        },
        showEditKudos:function(){
            return Session.get('selectedPerson');
        },
        "currentUser":function(){
            return Meteor.user();
        },
        "moreKudos":function(){
            return getKudosCount(Session.get('selectedPerson')) > Session.get("itemsLimit");
        },
        "kudosIncrement":function(){
            return kudosIncrement;
        }
        });

    Template.mediaItems.events({
        "submit": function(event) {
            event.preventDefault();
        },
        "click #addKudosButton":function(event){
            event.preventDefault();
            var kudosText = $('#kudosText').val();
            if (kudosText.length != 0){
                var user_to = Session.get('selectedPerson');
                kudos.insert({
                    from:Meteor.user().services.saml2.email,
                    to:user_to.email,
                    date:Date(),
                    text:kudosText,
                    comments:[]
                });
            }
            $('#kudosText').val(null);
        },
        "click #homePage":function(event){
            event.preventDefault();
            Session.set('selectedPerson', null);
            Session.set('itemsLimit', kudosIncrement);
            $('#users').val(null);
        },
        "click #moreKudosButton":function (event){
            event.preventDefault();
            showMoreVisible();
        }
    });

    Template.kudosItem.created = function() {
        Meteor.subscribe('rackUser', this.data.from);
        Meteor.subscribe('rackUser', this.data.to);
    };

    Template.kudosItem.helpers({
        "users":function(){
            var user_from = rackUsers.findOne({'email':this.from});
            var user_to = rackUsers.findOne({'email':this.to});
            return {"user_from":user_from, "user_to":user_to};
        },
        showComments:function(){
            return Session.get('showComments');
        },
        "commentsLinkId":function(){
            return this._id;
        },
        'showComments':function(){
            if (Session.get('buttonId') == this._id)
                return true;
        }
    });
    Template.kudosItem.events({
        "submit": function(event) {
            event.preventDefault();
        },
        'click':function(event){
            event.preventDefault();
            var objHash = event.target.hash;
            if (objHash != null){
                if (objHash.indexOf('commentLink') != -1){
                    if (Session.get('buttonId') == event.currentTarget.id)
                        Session.set('buttonId', null);
                    else
                        Session.set('buttonId', event.currentTarget.id);
                }
                if (objHash.indexOf('userLink') != -1)
                {
                    Session.set('selectedPerson',
                      rackUsers.findOne({email:event.currentTarget.id}));
                }
            }
        },
        "click #addCommentButton":function(event){
            event.preventDefault();
            var commentText = $('#commentText').val();
            if (commentText.length != 0)
                kudos.update({_id:this._id}, {$push:{
                    comments :{
                        author:Meteor.user().services.saml2.email,
                        date:new Date(),
                        text:commentText
                    }
                }});
            $('#commentText').val(null);
        }
    });

    Template.comments.helpers({
        "comment":function(){
            return kudos.findOne({_id:this._id}).comments;
        }
    });

    Template.comment.created = function() {
        Meteor.subscribe('rackUser', this.data.author);
    };

    Template.comment.helpers({
        "comment_author":function(){
            return rackUsers.findOne({email:this.author});
        }
    });
}

if (Meteor.isServer) {

    Meteor.publish('kudos', function(person, limit) {
        if (person) {
            kudos.find({to:person.email}, { limit : limit, sort: {date: 1}});
        } else {
            return kudos.find({}, { limit : limit, sort: {date: 1}});
        }
    });

    Meteor.publish("userData", function () {
        return Meteor.users.find({_id: this.userId});
    });

    Meteor.publish("rackUser", function (email) {
        return rackUsers.find({email:email});
    });

    var loggedIn = function(userId, doc) {
        var user = Meteor.users.findOne({_id: userId});
        return doc && doc.from === user.services.saml2.email;
    };

    var canComment = function(userId, doc, fields, modifier) {
        var user = Meteor.users.findOne({_id: userId});
        return (modifier.$push != null)
          && (modifier.$push.comments != null)
          && (modifier.$push.comments.author === user.services.saml2.email);
    };

    kudos.allow({
        insert: loggedIn,
        update: canComment,
        remove: loggedIn
    });
}
