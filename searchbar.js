if (Meteor.isClient) {
    Template.searchbar.events({
        "submit": function(event) {
            event.preventDefault();
        },
        "autocompleteselect input": function(event, template, doc) {
            Session.set('selectedPerson', doc);
        }
    });

    Template.searchbar.helpers({
      settings: function() {
        return {
          position: Session.get("position"),
          limit: 10,
          rules: [
            {
              // token: '',
              collection: 'rackUsers',
              subscription: 'ldapUsers',
              field: 'fullName',
              matchAll: true,
              template: Template.userPill
            }
          ]
        };
      }      
    });
}


if (Meteor.isServer) {
  Meteor.publish("ldapUsers", function(selector, options) {
    Autocomplete.publishCursor(rackUsers.find(selector, options), this);
    this.ready();
  });
}