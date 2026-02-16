window.App = window.App || {};
window.App.Mix = {
    init: function() {
        window.App.Filters.setupHierarchyFilters('mix', () => this.render());
        window.App.Filters.setupGenericFilters('mix');
    },
    render: function() {
        // ... logic
    }
};
