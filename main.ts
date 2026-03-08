import {
    App,
    addIcon,
    setIcon,
    Plugin,
    ItemView,
    WorkspaceLeaf,
    PluginSettingTab,
    Setting,
    Notice,
    TextComponent,
    AbstractInputSuggest
} from 'obsidian';

const DEADLINE_VIEW = "grotto-deadline-countdown";
const DEFAULT_CATEGORY = "General";
const DEFAULT_RECURRENCE = 0;
const DEFAULT_WARNING = 0;

interface DeadlineSettings {
    deadlineTitle: string;
    deadlineDateTime: string;
    deadlineRecurrenceSet: boolean;
    deadlineRecurrenceValue?: number;
    deadlineWarningSet: boolean;
    deadlineWarningValue?: number;
    categories: string[];
    selectedCategory?: string;
    deadlines: Deadline[];
    collapsedCategories: string[];
}

interface Deadline {
    title: string;
    dateTime: string;
    recurrence: number;
    warning: number;
    category: string;
}

const DEFAULT_SETTINGS: DeadlineSettings = {
    deadlineTitle: '',
    deadlineDateTime: new Date().toISOString().slice(0, 16),
    deadlineRecurrenceSet: false,
    deadlineWarningSet: false,
    categories: [DEFAULT_CATEGORY],
    selectedCategory: DEFAULT_CATEGORY,
    deadlines: [],
    collapsedCategories: []
};

export default class DeadlinePlugin extends Plugin {
    settings: DeadlineSettings = DEFAULT_SETTINGS;
    async onload(): Promise<void> {
        await this.loadSettings();
        this.registerView(
            DEADLINE_VIEW,
            (leaf: WorkspaceLeaf) => new GrottoSidebarView(leaf, this)
        );
        // This is the main icon to represent the plugin
        addIcon('deadline-preset-icon', '<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-timer-icon lucide-timer"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>');
        this.app.workspace.onLayoutReady(() => {
            void this.activateView();
        });
        this.addSettingTab(new DeadlineSettingsTab(this.app, this));
        // Command Palette command to open the sidebar view only available if closed
        this.addCommand({
            id: "show-deadline-view",
            name: "Open deadline view",
            checkCallback: (checking: boolean) => {
                if (checking) {
                    return (
                        this.app.workspace.getLeavesOfType(DEADLINE_VIEW).length === 0
                    );
                }
                void this.activateView();
            },
        });
    }
    async activateView() {
        if (this.app.workspace.getLeavesOfType(DEADLINE_VIEW).length) {
            return;
        }
        const leaf = this.app.workspace.getRightLeaf(false);
        if (!leaf) {
            return;
        }
        const activeView = leaf.view;
        if (!activeView || activeView.getViewType() !== DEADLINE_VIEW) {
            await leaf.setViewState({ type: DEADLINE_VIEW });
            void this.app.workspace.revealLeaf(leaf);
        }
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        if (!this.settings.categories.includes(DEFAULT_CATEGORY)) {
            this.settings.categories.unshift(DEFAULT_CATEGORY);
            await this.saveSettings();
        }
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    onunload() {
        this.app.workspace
            .getLeavesOfType(DEADLINE_VIEW)
            .forEach((leaf) => leaf.detach());
    }
}

export class GrottoSidebarView extends ItemView {
    plugin: DeadlinePlugin;
    constructor(leaf: WorkspaceLeaf, plugin: DeadlinePlugin) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType() {
        return DEADLINE_VIEW;
    }
    getDisplayText() {
        // Revert this back from sentence case if the plugin gets approved
        return "Deadline countdown";
    }
    getIcon(): string {
        return "deadline-preset-icon";
    }
    async onOpen(): Promise<void> {
        this.renderSidebar();
        await Promise.resolve();
    }
    renderSidebar() {
        this.containerEl.empty();
        const container = this.containerEl.createEl("div", {
            cls: "grotto-deadline-container-sidebar"
        });
        // Refresh Button
        const refreshButtonContainer = container.createEl("div", {
            cls: "grotto-refresh-button-container"
        });
        const refreshButton = refreshButtonContainer.createEl("button", {
            text: "Refresh"
        });
        refreshButton.onclick = () => this.refreshSidebar();
        // In case there are no active deadlines
        if (!this.plugin.settings.deadlines || this.plugin.settings.deadlines.length === 0) {
            container.createEl("p", {
                text: "No upcoming deadlines"
            });
            return;
        }
        // Deadlines
        const groupedDeadlines = this.groupDeadlinesByCategory(this.plugin.settings.deadlines);
        const sortedCategories = Object.keys(groupedDeadlines).sort((a, b) => a.localeCompare(b));
        for (const category of sortedCategories) {
            const deadlines = groupedDeadlines[category];
            const categorySection = container.createEl('div', {
                cls: 'grotto-category-section'
            });
            categorySection.setAttribute('data-category', category);
            const categoryHeader = categorySection.createEl('h3', {
                text: category,
                cls: 'grotto-category-title'
            });
            categoryHeader.onclick = async () => {
                const isCollapsed = deadlineList.hasClass("grotto-collapsed");
                if (isCollapsed) {
                    this.plugin.settings.collapsedCategories = this.plugin.settings.collapsedCategories.filter(c => c !== category);
                    deadlineList.removeClass('grotto-collapsed');
                } else {
                    this.plugin.settings.collapsedCategories.push(category);
                    deadlineList.addClass('grotto-collapsed');
                }
                await this.plugin.saveSettings();
            };
            const deadlineList = categorySection.createEl('div', {
                cls: 'grotto-deadline-categories'
            });
            if (this.plugin.settings.collapsedCategories.includes(category)) {
                deadlineList.addClass('grotto-collapsed');
            }
            deadlines.forEach((dl) => {
                const dlEl = deadlineList.createEl('div', {
                    cls: 'grotto-deadline-card'
                });
                const cardContainer = dlEl.createEl('div', {
                    cls: 'grotto-deadline-card-container'
                });
                // Title
                const titleEl = cardContainer.createEl('span', {
                    text: dl.title,
                    cls: 'grotto-deadline-title'
                });
                titleEl.setText(dl.title);
                // Deadline Date
                const dateEl = cardContainer.createEl('div', {
                    cls: 'grotto-deadline-date'
                });
                const deadlineDate = new Date(dl.dateTime);
                dateEl.createEl('span', {
                    text: 'Deadline',
                    cls: 'grotto-deadline-label'
                });
                dateEl.createEl('span', {
                    text: ': ' + deadlineDate.toLocaleString('en-GB', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true,
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    }),
                    cls: 'grotto-deadline-date-value'
                });
                // Determine if the deadline has urgent status
                const now = new Date();
                const timeDifference = deadlineDate.getTime() - now.getTime();
                const isUrgent = timeDifference <= dl.warning * 60 * 60 * 1000;
                dlEl.removeClass('grotto-deadline-warning');
                if (isUrgent) {
                    dlEl.addClass('grotto-deadline-warning');
                }
                const remainingTimeEl = cardContainer.createEl('div', {
                    cls: 'grotto-deadline-remaining'
                });
                this.updateRemainingTime(dl, remainingTimeEl);
                const status = calculateRemaining(dl);
                if (status.label === "Deadline passed") {
                    const deleteButton = dlEl.createEl('span', {
                        cls: 'clickable-icon grotto-deadline-delete-right'
                    });
                    setIcon(deleteButton, 'trash');
                    deleteButton.onclick = async () => {
                        const idx = this.plugin.settings.deadlines.indexOf(dl);
                        if (idx > -1) this.plugin.settings.deadlines.splice(idx, 1);
                        await this.plugin.saveSettings();
                        this.renderSidebar();
                        new Notice('Deadline removed');
                    };
                }
            });
        }
    }
    refreshSidebar() {
        this.renderSidebar();
    }
    groupDeadlinesByCategory(deadlines: Deadline[]) {
        return deadlines.reduce((groups, deadline) => {
            if (!groups[deadline.category]) {
                groups[deadline.category] = [];
            }
            groups[deadline.category].push(deadline);
            return groups;
        }, {} as { [key: string]: Deadline[] });
    }
    // Function to update the remaining time for each deadline
    updateRemainingTime(deadline: Deadline, remainingTimeEl: HTMLElement) {
        const remainingLabelEl = remainingTimeEl.createEl('span');
        const remainingValueEl = remainingTimeEl.createEl('span', {
            cls: 'grotto-deadline-time-value'
        });
        const update = () => {
            // Reset classes and text
            remainingLabelEl.setText('');
            remainingValueEl.setText('');
            remainingLabelEl.removeClass('grotto-deadline-ends');
            remainingLabelEl.removeClass('grotto-deadline-resets');
            remainingLabelEl.removeClass('grotto-deadline-passed');
            const status = calculateRemaining(deadline);
            remainingLabelEl.setText(status.label);
            remainingLabelEl.addClass(status.className);
            if (status.nextDate) {
                remainingValueEl.setText(': ' + this.formatRemainingTime(status.nextDate));
                // Update the deadline time if it recurred
                if (status.label === "Resets in" && new Date(deadline.dateTime) <= new Date()) {
                    deadline.dateTime = status.nextDate.toISOString();
                }
            }
            void this.plugin.saveSettings();
        };
        update();
    }
    formatRemainingTime(deadlineDate: Date) {
        const now = new Date();
        const timeDifference = deadlineDate.getTime() - now.getTime();
        const remainingDays = Math.floor(timeDifference / (1000 * 3600 * 24));
        const remainingHours = Math.floor((timeDifference % (1000 * 3600 * 24)) / (1000 * 3600));
        const remainingMinutes = Math.floor((timeDifference % (1000 * 3600)) / (1000 * 60));
        let remainingTimeText = '';
        if (remainingDays > 0) {
            remainingTimeText += `${remainingDays} days `;
        }
        if (remainingHours > 0) {
            remainingTimeText += `${remainingHours} hours `;
        }
        remainingTimeText += `${remainingMinutes} minutes`;
        return remainingTimeText;
    }
}

class DeadlineSettingsTab extends PluginSettingTab {
    plugin: DeadlinePlugin;
    deadlines: Deadline[] = [];
    constructor(app: App, plugin: DeadlinePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        // Deadline Controls
        const newDeadline = containerEl.createEl('div', { cls: 'setting-group' });
        newDeadline
            .createEl('div', {
                cls: 'setting-item setting-item-heading'
            })
            .createEl('div', {
                text: 'Deadline controls',
                cls: 'setting-item-name'
            });
        const deadlineItems = newDeadline.createEl('div', {
            cls: 'setting-items'
        });
        // Title
        new Setting(deadlineItems)
            .setName("Title")
            .setDesc("Set a title for the deadline")
            .addText((text) => {
                text.setPlaceholder('Enter a title');
                text.setValue(this.plugin.settings.deadlineTitle);
                text.onChange((value) => {
                    this.plugin.settings.deadlineTitle = value;
                });
            });
        // Date and Time
        new Setting(deadlineItems)
            .setName("Date and time")
            .setDesc("Set a deadline using the calendar and time picker")
            .addText((text) => {
                text.inputEl.type = "datetime-local";
                text.setValue(this.plugin.settings.deadlineDateTime);
                text.onChange((value) => {
                    this.plugin.settings.deadlineDateTime = value;
                });
            });
        // Recurrence Toggle
        new Setting(deadlineItems)
            .setName('Recurrence')
            .setDesc('Enable to set a recurring interval for the deadline')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.deadlineRecurrenceSet)
                    .onChange((value) => {
                        this.plugin.settings.deadlineRecurrenceSet = value;
                        // Set recurrence to 0 when toggle is off
                        if (!value) {
                            this.plugin.settings.deadlineRecurrenceValue = 0;
                        }
                        // Set recurrence to the slider value when toggle is on
                        else {
                            this.plugin.settings.deadlineRecurrenceValue = this.plugin.settings.deadlineRecurrenceValue || 1;
                        }
                        // Hide or show the recurrence slider
                        recurrenceSliderSetting.settingEl.toggleClass('grotto-hidden-slider', !value);
                        // Save settings after the change
                        void this.plugin.saveSettings();
                    });
            });
        // Recurrence Interval Slider
        let recurrenceSliderSetting: Setting;
        recurrenceSliderSetting = new Setting(deadlineItems)
            .setName('Recurrence interval')
            .setDesc('Set how often this deadline repeats (1–30 days)')
            .addSlider(slider => {
                slider.setLimits(1, 30, 1)
                    .setValue(this.plugin.settings.deadlineRecurrenceValue ?? DEFAULT_RECURRENCE)
                    .setDynamicTooltip()
                    .onChange(value => {
                        this.plugin.settings.deadlineRecurrenceValue = Math.floor(value);
                    });
            });
        // Control visibility of the recurrence slider
        recurrenceSliderSetting.settingEl.toggleClass('grotto-hidden-slider', !this.plugin.settings.deadlineRecurrenceSet);
        // Warning Toggle
        new Setting(deadlineItems)
            .setName('Warning')
            .setDesc('Enable to set a visual warning for the deadline')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.deadlineWarningSet)
                    .onChange((value) => {
                        this.plugin.settings.deadlineWarningSet = value;
                        // Set recurrence to 0 when toggle is off
                        if (!value) {
                            this.plugin.settings.deadlineWarningValue = 0;
                        }
                        // Set recurrence to the slider value when toggle is on
                        else {
                            this.plugin.settings.deadlineWarningValue = this.plugin.settings.deadlineWarningValue || 1;
                        }
                        // Hide or show the recurrence slider
                        warningSliderSetting.settingEl.toggleClass('grotto-hidden-slider', !value);
                        // Save settings after the change
                        void this.plugin.saveSettings();
                    });
            });
        // Warning Slider
        let warningSliderSetting: Setting;
        warningSliderSetting = new Setting(deadlineItems)
            .setName('Advanced warning time')
            .setDesc('Set when a warning is given before the deadline ends (1 - 24 hours)')
            .addSlider(slider => {
                slider.setLimits(1, 24, 1)
                    .setValue(this.plugin.settings.deadlineWarningValue ?? DEFAULT_WARNING)
                    .setDynamicTooltip()
                    .onChange(value => {
                        this.plugin.settings.deadlineWarningValue = Math.floor(value);
                    });
            });
        // Control visibility of the warning slider
        warningSliderSetting.settingEl.toggleClass('grotto-hidden-slider', !this.plugin.settings.deadlineWarningSet);
        // Category
        let categoryInput: string = "";
        let textComponent: TextComponent;
        new Setting(deadlineItems)
            .setName('Category')
            .setDesc('Set a category for the deadline')
            .addText(text => {
                textComponent = text;
                text.setPlaceholder('Enter a category');
                new CategorySuggest(this.app, text.inputEl, this.plugin.settings.categories);
                text.onChange((value) => {
                    categoryInput = value.trim();
                });
            })
        // Save Deadline
        new Setting(deadlineItems)
            .addButton(button => {
                button.setButtonText("Save deadline")
                    .setCta()
                    .onClick(async () => {
                        const title = this.plugin.settings.deadlineTitle.trim();
                        const dateTime = this.plugin.settings.deadlineDateTime;
                        const recurrence = this.plugin.settings.deadlineRecurrenceValue || 0;
                        const warning = this.plugin.settings.deadlineWarningValue || 0;
                        // Determine final category
                        let finalCategory = (categoryInput || DEFAULT_CATEGORY).trim();
                        if (!this.plugin.settings.categories.includes(finalCategory)) {
                            this.plugin.settings.categories.push(finalCategory);
                            new Notice(`New category created: ${finalCategory}`);
                        }
                        // In case a title is not set
                        if (!title) {
                            new Notice("Please set a valid title.");
                            return;
                        }
                        // In case date/time is reset
                        if (!dateTime) {
                            new Notice("Please set a date and time for the deadline.");
                            return;
                        }
                        // Initialize deadlines array if needed
                        if (!this.plugin.settings.deadlines) this.plugin.settings.deadlines = [];
                        // Save deadline
                        this.plugin.settings.deadlines.push({
                            title,
                            dateTime,
                            category: finalCategory,
                            recurrence,
                            warning,
                        });
                        // Reset deadling settings
                        this.plugin.settings.deadlineTitle = '';
                        this.plugin.settings.deadlineDateTime = new Date().toISOString().slice(0, 16);
                        this.plugin.settings.selectedCategory = DEFAULT_CATEGORY;
                        this.plugin.settings.deadlineRecurrenceSet = false;
                        this.plugin.settings.deadlineRecurrenceValue = DEFAULT_RECURRENCE;
                        this.plugin.settings.deadlineWarningSet = false;
                        this.plugin.settings.deadlineWarningValue = DEFAULT_WARNING;
                        categoryInput = '';
                        textComponent.setValue('');
                        await this.plugin.saveSettings();
                        this.display();
                        new Notice("Deadline set successfully!");
                    });
            });
        // Deadline Management section
        const managesDeadline = containerEl.createEl('div', { cls: 'setting-group' });
        managesDeadline
            .createEl('div', { cls: 'setting-item setting-item-heading' })
            .createEl('div', { text: 'Deadline management', cls: 'setting-item-name' });
        const manageDeadlineItems = managesDeadline.createEl('div', { cls: 'setting-items' });
        const sortedCategories = this.plugin.settings.categories
            .slice()
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        sortedCategories.forEach(category => {
            const categoryContainer = manageDeadlineItems.createEl('div', { cls: 'grotto-category-container' });
            // Category header
            categoryContainer.createEl('div', {
                text: category,
                cls: 'grotto-category-header'
            });
            // Deadlines in categories
            const deadlinesContainer = categoryContainer.createEl('div', { cls: 'grotto-deadlines-container' });
            const categoryDeadlines = (this.plugin.settings.deadlines || []).filter(dl => dl.category === category);
            categoryDeadlines.forEach(dl => {
                const dlEl = deadlinesContainer.createEl('div', { cls: 'grotto-deadline-card' });
                const cardContainer = dlEl.createEl('div', { cls: 'grotto-deadline-card-container' });
                // Title
                const titleEl = cardContainer.createEl('span', { text: dl.title, cls: 'grotto-deadline-title' });
                titleEl.setText(dl.title);
                // Deadline Date
                const dateEl = cardContainer.createEl('div', { cls: 'grotto-deadline-date' });
                const deadlineDate = new Date(dl.dateTime);
                dateEl.createEl('span', {
                    text: 'Deadline',
                    cls: 'grotto-deadline-label'
                });
                dateEl.createEl('span', {
                    text: ': ' + deadlineDate.toLocaleString('en-GB', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true,
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    }),
                    cls: 'grotto-deadline-date-value'
                });
                // Interval
                const intervalTimeEl = cardContainer.createEl('div', { cls: 'grotto-deadline-interval' });
                if (dl.recurrence > 0) {
                    intervalTimeEl.createEl('span', {
                        text: 'Interval',
                        cls: 'grotto-deadline-label'
                    });
                    intervalTimeEl.createEl('span', {
                        text: `: Every ${dl.recurrence} day${dl.recurrence > 1 ? 's' : ''}`,
                        cls: 'grotto-deadline-interval-value'
                    });
                }
                // Warning
                const warningTimeEl = cardContainer.createEl('div', { cls: 'grotto-deadline-warning-time' });
                if (dl.warning > 0) {
                    warningTimeEl.createEl('span', {
                        text: 'Warning',
                        cls: 'grotto-deadline-label'
                    });
                    warningTimeEl.createEl('span', {
                        text: `: ${dl.warning} hour${dl.warning > 1 ? 's' : ''} in advance`,
                        cls: 'grotto-deadline-warning-value'
                    });
                }
                // Remaining Time
                const remainingTimeEl = cardContainer.createEl('div', { cls: 'grotto-deadline-remaining' });
                const remainingLabelEl = remainingTimeEl.createEl('span');
                const remainingValueEl = remainingTimeEl.createEl('span', { cls: 'grotto-deadline-time-value' });
                const updateRemainingTime = () => {
                    remainingLabelEl.setText('');
                    remainingValueEl.setText('');
                    remainingLabelEl.removeClass('grotto-deadline-ends');
                    remainingLabelEl.removeClass('grotto-deadline-resets');
                    remainingLabelEl.removeClass('grotto-deadline-passed');
                    const status = calculateRemaining(dl);
                    remainingLabelEl.setText(status.label);
                    remainingLabelEl.addClass(status.className);
                    if (status.nextDate) {
                        remainingValueEl.setText(': ' + formatTime(status.nextDate));
                        // Update the deadline object if it recurred
                        if (status.label === 'Resets in' && new Date(dl.dateTime) <= new Date()) {
                            dl.dateTime = status.nextDate.toISOString();
                        }
                    }
                    void this.plugin.saveSettings();
                };
                //Function for formatting time
                const formatTime = (date: Date) => {
                    const diff = date.getTime() - new Date().getTime();
                    const days = Math.floor(diff / (1000 * 3600 * 24));
                    const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));
                    const mins = Math.floor((diff % (1000 * 3600)) / (1000 * 60));
                    return `${days > 0 ? days + ' days ' : ''}${hours > 0 ? hours + ' hours ' : ''}${mins} minutes`;
                };
                // Initial call and interval
                updateRemainingTime();
                setInterval(updateRemainingTime, 10000);
                // Actions
                const actionsContainer = dlEl.createEl('div', { cls: 'grotto-deadline-actions' });
                const movementContainer = actionsContainer.createEl('div', { cls: 'grotto-deadline-move-actions' });
                const deadlineItems = this.plugin.settings.deadlines;
                // Move Up
                const moveUp = movementContainer.createEl('span', {
                    cls: 'clickable-icon'
                });
                setIcon(moveUp, 'chevron-up');
                moveUp.onclick = async () => {
                    const categoryItems = (deadlineItems || []).filter(d => d.category === category);
                    const idx = categoryItems.indexOf(dl);
                    if (idx > 0) {
                        const globalIdx = deadlineItems.indexOf(dl);
                        const prevItem = categoryItems[idx - 1];
                        const prevGlobalIdx = deadlineItems.indexOf(prevItem);
                        [deadlineItems[globalIdx], deadlineItems[prevGlobalIdx]] =
                            [deadlineItems[prevGlobalIdx], deadlineItems[globalIdx]];
                        await this.plugin.saveSettings();
                        this.display();
                    }
                };
                // Move Down 
                const moveDown = movementContainer.createEl('span', {
                    cls: 'clickable-icon'
                });
                setIcon(moveDown, 'chevron-down');
                moveDown.onclick = async () => {
                    const categoryItems = (deadlineItems || []).filter(d => d.category === category);
                    const idx = categoryItems.indexOf(dl);
                    if (idx < categoryItems.length - 1) {
                        const globalIdx = deadlineItems.indexOf(dl);
                        const nextItem = categoryItems[idx + 1];
                        const nextGlobalIdx = deadlineItems.indexOf(nextItem);
                        [deadlineItems[globalIdx], deadlineItems[nextGlobalIdx]] =
                            [deadlineItems[nextGlobalIdx], deadlineItems[globalIdx]];
                        await this.plugin.saveSettings();
                        this.display();
                    }
                };
                // Delete
                const deadlineDelete = actionsContainer.createEl('span', {
                    cls: 'clickable-icon'
                });
                setIcon(deadlineDelete, 'trash');
                deadlineDelete.onclick = async () => {
                    const idx = deadlineItems.indexOf(dl);
                    if (idx > -1) deadlineItems.splice(idx, 1);
                    await this.plugin.saveSettings();
                    this.display();
                    new Notice('Deadline removed');
                };
            });
            // Delete button for empty categories
            if (categoryDeadlines.length === 0 && category !== DEFAULT_CATEGORY) {
                const deleteCategoryBtn = deadlinesContainer.createEl('button', { text: 'Delete category', cls: 'grotto-delete-category-btn' });
                deleteCategoryBtn.onclick = async () => {
                    const idx = this.plugin.settings.categories.indexOf(category);
                    if (idx > -1) this.plugin.settings.categories.splice(idx, 1);
                    await this.plugin.saveSettings();
                    this.display();
                    new Notice(`Category "${category}" deleted`);
                };
            }
            else if (categoryDeadlines.length === 0 && category == DEFAULT_CATEGORY) {
                deadlinesContainer.createEl('p', { text: 'This is the default category', cls: 'grotto-default-category-message' });
            }
        });
    }
}

class CategorySuggest extends AbstractInputSuggest<string> {
    categories: string[];
    inputEl: HTMLInputElement;
    constructor(app: App, inputEl: HTMLInputElement, categories: string[]) {
        super(app, inputEl);
        this.inputEl = inputEl;
        this.categories = categories;
    }
    getSuggestions(query: string): string[] {
        return this.categories.filter(cat =>
            cat.toLowerCase().includes(query.toLowerCase())
        );
    }
    renderSuggestion(value: string, el: HTMLElement) {
        el.setText(value);
    }
    selectSuggestion(value: string) {
        this.inputEl.value = value;
        this.inputEl.dispatchEvent(new Event("input"));
        this.close();
    }
}

function calculateRemaining(deadline: Deadline) {
    const now = new Date();
    const deadlineDate = new Date(deadline.dateTime);
    const diff = deadlineDate.getTime() - now.getTime();
    if (diff <= 0) {
        if (deadline.recurrence && deadline.recurrence > 0) {
            const next = new Date(deadlineDate);
            next.setDate(next.getDate() + deadline.recurrence);
            return {
                label: "Resets in",
                className: "grotto-deadline-resets",
                nextDate: next
            };
        }
        return {
            label: "Deadline passed",
            className: "grotto-deadline-passed",
            nextDate: null
        };
    }
    if (deadline.recurrence && deadline.recurrence > 0) {
        return {
            label: "Resets in",
            className: "grotto-deadline-resets",
            nextDate: deadlineDate
        };
    }
    return {
        label: "Ends in",
        className: "grotto-deadline-ends",
        nextDate: deadlineDate
    };
}
