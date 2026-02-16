window.App = window.App || {};
window.App.Coverage = {
    init: function() {
        window.App.Filters.setupHierarchyFilters('coverage', () => this.render());
    },
    render: function() {
        // ... logic
    }
};
