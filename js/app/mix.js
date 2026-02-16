window.App = window.App || {};
window.App.Mix = {
    init: function() {
        window.App.Filters.setupHierarchyFilters('mix', () => this.render());
    },
    render: function() {
        // ... logic
    }
};
