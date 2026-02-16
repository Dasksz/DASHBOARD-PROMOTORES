window.App = window.App || {};
window.App.Coverage = {
    init: function() {
        window.App.Filters.setupHierarchyFilters('coverage', () => this.render());
        window.App.Filters.setupGenericFilters('coverage');
    },
    render: function() {
        // ... logic
    }
};
