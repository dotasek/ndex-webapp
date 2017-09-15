/**
 * Created by chenjing on 5/10/16.
 */

ndexApp.service('sharedProperties', function () {
    // this service is going to act as a general global variable throughout the application
    // should consider implementing some degree of relationship with localStorage to guard against
    // refreshes. In fact, we might just use cookies or something else because we may not want this to be permanent

    return {
        getCurrentNetworkId: function () {
            //if (!this.currentNetworkId) this.currentNetworkId = "C25R1174";   // hardwired for testing
            return this.currentNetworkId;
        },
        setCurrentNetworkId: function (value) {
            //should save in local storage
            this.currentNetworkId = value;
        },
        getCurrentUserId: function () {
            //if (!this.currentUserId) this.currentUserId = "C31R4";   // hardwired for testing
            return this.currentUserId;
        },
        setCurrentUserId: function (currentUserId) {
            this.currentUserId = currentUserId;
        },
        getCurrentUserAccountName: function () {
            //if (!this.currentUserId) this.currentUserId = "C31R4";   // hardwired for testing
            return this.userName;
        },
        setCurrentUser: function (value, accountName) {
            this.currentUserId = value;
            this.userName = accountName;
        },
        setCurrentQueryTerms: function(currentQueryTerms)
        {
            this.currentQueryTerms = currentQueryTerms;
        },
        getCurrentQueryTerms: function()
        {
            return this.currentQueryTerms;
        },
        setCurrentQueryDepth: function(currentQueryDepth)
        {
            this.currentQueryDepth = currentQueryDepth;
        },
        getCurrentQueryDepth: function()
        {
            return this.currentQueryDepth;
        },
        setSelectedNetworkIDs: function(selectedIDs)
        {
            this.selectedNetworkIDs = selectedIDs;
        },
        getSelectedNetworkIDs: function()
        {
            return this.selectedNetworkIDs;
        },
        setNetworkViewPage: function(networkView)
        {
            this.networkView = networkView;
        },
        getNetworkViewPage: function()
        {
            return this.networkView;
        },
        testMe: function () {
            return "hello there";
        },

        setSignedInUser: function (signedInUser) {
            this.signedInUser = signedInUser;
        },

        getSignedInUser: function () {
            return this.signedInUser;
        },

        // valid type are 'google or basic' right now.
        setSignOnType : function (type) {
            this.signOnType = type;
        },

        getSignonType: function () {
            return this.signOnType;
        },

        getLoggedInUserFirstAndLastNames: function () {
            if (this.signedInUser != null) {
                return this.signedInUser.firstName + " " + this.signedInUser.lastName;
            } else
                return "";
        }
     }
});
