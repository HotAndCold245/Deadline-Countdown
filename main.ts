import {
    App,
    addIcon,
    Plugin,
    ItemView,
    WorkspaceLeaf,
    PluginSettingTab,
    Setting,
    Notice,
    TextComponent
} from 'obsidian';

const TIMER_COUNT_VIEW = "grotto-countdown";
const DEFAULT_CATEGORY = "General";

interface CountdownSettings {
    deadlineTitle: string;
    deadlineDateTime: string;
    deadlineFrequency: boolean;
    categories: string[];
    selectedCategory?: string;
    selectedRecurrence?: string | null;
    selectedRecurrenceValue?: number;
    deadlines?: Deadline[];
}

interface Deadline {
    title: string;
    dateTime: string;
    category: string;
    recurrence: number;
}

const DEFAULT_SETTINGS: CountdownSettings = {
    deadlineTitle: '',
    deadlineDateTime: new Date().toISOString().slice(0, 16),
    deadlineFrequency: false,
    categories: [DEFAULT_CATEGORY],
    selectedCategory: DEFAULT_CATEGORY,
};

export default class CountdownPlugin extends Plugin {
    settings: CountdownSettings = DEFAULT_SETTINGS;
    deadlines: Deadline[] = [];
    async onload(): Promise<void> {
        await this.loadSettings();
        this.registerView(
            TIMER_COUNT_VIEW,
            (leaf: WorkspaceLeaf) => new GrottoSidebarView(leaf, this)
        );
        addIcon('countdown-preset', '<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-timer-icon lucide-timer"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>');
        this.app.workspace.onLayoutReady(() => {
            this.activateView();
        });
        this.addSettingTab(new CountdownSettingsTab(this.app, this));
        // Command Palette command to open the sidebar view if closed
        this.addCommand({
            id: "show-deadline-view",
            name: "Open Deadline View",
            checkCallback: (checking: boolean) => {
                if (checking) {
                    return (
                        this.app.workspace.getLeavesOfType(TIMER_COUNT_VIEW).length === 0
                    );
                }
                this.activateView();
            },
        });
    }
    async activateView() {
        if (this.app.workspace.getLeavesOfType(TIMER_COUNT_VIEW).length) {
            // Return if the view is already active
            return;
        }
        const leaf = this.app.workspace.getRightLeaf(false);
        if (!leaf) {
            return;
        }
        const activeView = leaf.view;
        if (!activeView || activeView.getViewType() !== TIMER_COUNT_VIEW) {
            await leaf.setViewState({ type: TIMER_COUNT_VIEW });
            this.app.workspace.revealLeaf(leaf);
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
            .getLeavesOfType(TIMER_COUNT_VIEW)
            .forEach((leaf) => leaf.detach());
    }
}

export class GrottoSidebarView extends ItemView {
    plugin: CountdownPlugin;
    constructor(leaf: WorkspaceLeaf, plugin: CountdownPlugin) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType() {
        return TIMER_COUNT_VIEW;
    }
    getDisplayText() {
        return "Deadline Countdown";
    }
    getIcon(): string {
        return "countdown-preset";
    }
    async onOpen() {
        this.containerEl.empty();
        this.renderSidebar();
    }
    renderSidebar() {
        this.containerEl.empty();
        const container = this.containerEl.createEl("div", {
            cls: "grotto-deadline-container-sidebar"
        });
        // Refresh Button
        const refreshButtonContainer = container.createEl("div", { cls: "grotto-refresh-button-container" });
        const refreshButton = refreshButtonContainer.createEl("button", { text: "Refresh" });
        refreshButton.addEventListener("click", () => this.refreshSidebar());
        // In case there are no active deadlines
        if (!this.plugin.settings.deadlines || this.plugin.settings.deadlines.length === 0) {
            container.createEl("p", { text: "No upcoming deadlines" });
            return;
        }
        // Deadlines
        const groupedDeadlines = this.groupDeadlinesByCategory(this.plugin.settings.deadlines);
        const sortedCategories = Object.keys(groupedDeadlines).sort((a, b) => a.localeCompare(b));
        for (const category of sortedCategories) {
            const deadlines = groupedDeadlines[category];
            let categorySection = this.containerEl.querySelector(`.grotto-category-section[data-category="${category}"]`);
            if (!categorySection) {
                categorySection = container.createEl('div', {
                    cls: 'grotto-category-section'
                });
                categorySection.setAttribute('data-category', category);
                categorySection.createEl('h3', { text: category });
            }
            const deadlineList = categorySection.createEl('div', {
                cls: 'grotto-deadline-categories'
            });
            deadlines.forEach((dl) => {
                const dlEl = deadlineList.createEl('div', { cls: 'grotto-deadline-card' });
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
                // Determine if the deadline is urgent (less than 1 hour away)
                const now = new Date();
                const timeDifference = deadlineDate.getTime() - now.getTime();
                const isUrgent = timeDifference <= 60 * 60 * 1000;
                dlEl.removeClass('grotto-deadline-urgent');
                if (isUrgent) {
                    dlEl.addClass('grotto-deadline-urgent');
                }
                const remainingTimeEl = cardContainer.createEl('div', {
                    cls: 'grotto-deadline-remaining'
                });
                this.updateRemainingTime(dl, remainingTimeEl);
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
            const now = new Date();
            const deadlineDate = new Date(deadline.dateTime);
            const diff = deadlineDate.getTime() - now.getTime();
            // Reset
            remainingLabelEl.setText('');
            remainingValueEl.setText('');
            remainingLabelEl.removeClass('grotto-deadline-ends');
            remainingLabelEl.removeClass('grotto-deadline-resets');
            remainingLabelEl.removeClass('grotto-deadline-passed');
            if (diff <= 0) {
                if (deadline.recurrence && deadline.recurrence > 0) {
                    const next = new Date(deadlineDate);
                    next.setDate(next.getDate() + deadline.recurrence);
                    deadline.dateTime = next.toISOString();
                    remainingLabelEl.setText('Resets in');
                    remainingLabelEl.addClass('grotto-deadline-resets');
                    remainingValueEl.setText(': ' + this.formatRemainingTime(next));
                } else {
                    remainingLabelEl.setText('Deadline Passed');
                    remainingLabelEl.addClass('grotto-deadline-passed');
                }
            } else {
                if (deadline.recurrence && deadline.recurrence > 0) {
                    remainingLabelEl.setText('Resets in');
                    remainingLabelEl.addClass('grotto-deadline-resets');
                    remainingValueEl.setText(': ' + this.formatRemainingTime(deadlineDate));
                } else {
                    remainingLabelEl.setText('Ends in');
                    remainingLabelEl.addClass('grotto-deadline-ends');
                    remainingValueEl.setText(': ' + this.formatRemainingTime(deadlineDate));
                }
            }
            this.plugin.saveSettings();
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

class CountdownSettingsTab extends PluginSettingTab {
    plugin: CountdownPlugin;
    deadlines: Deadline[] = [];
    constructor(app: App, plugin: CountdownPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        // Deadline Controls
        const newDeadline = containerEl.createEl('div', { cls: 'setting-group' });
        newDeadline
            .createEl('div', { cls: 'setting-item setting-item-heading' })
            .createEl('div', { text: 'Deadline Controls', cls: 'setting-item-name' });
        const deadlineItems = newDeadline.createEl('div', { cls: 'setting-items' });
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
            .setName("Date and Time")
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
                    .setValue(this.plugin.settings.deadlineFrequency)
                    .onChange(async (value) => {
                        this.plugin.settings.deadlineFrequency = value;
                        // Set recurrence to 0 when toggle is off
                        if (!value) {
                            this.plugin.settings.selectedRecurrenceValue = 0;
                        }
                        // Set recurrence to the slider value when toggle is on
                        else {
                            this.plugin.settings.selectedRecurrenceValue = this.plugin.settings.selectedRecurrenceValue || 1;
                        }
                        // Hide or show the recurrence slider
                        if (recurrenceSliderSetting) {
                            recurrenceSliderSetting.settingEl.style.display = value ? '' : 'none';
                        }
                        // Save settings after the change
                        await this.plugin.saveSettings();
                    });
            });
        // Recurrence Interval Slider
        let recurrenceSliderSetting: Setting;
        recurrenceSliderSetting = new Setting(deadlineItems)
            .setName('Recurrence Interval')
            .setDesc('Set how often this deadline repeats (1–30 days)')
            .addSlider(slider => {
                slider.setLimits(1, 30, 1)
                    .setValue(this.plugin.settings.selectedRecurrenceValue ?? 1)
                    .setDynamicTooltip()
                    .onChange(value => {
                        this.plugin.settings.selectedRecurrenceValue = Math.floor(value);
                    });
            });
        // Control visibility of the slider
        if (!this.plugin.settings.deadlineFrequency) {
            recurrenceSliderSetting.settingEl.style.display = 'none';
        }
        // Category
        let categoryInput: string = "";
        let textComponent: TextComponent;
        new Setting(deadlineItems)
            .setName('Category')
            .setDesc('Set a category for the deadline')
            .addText(text => {
                textComponent = text;
                text.setPlaceholder('Enter a category');
                text.onChange((value) => {
                    categoryInput = value.trim();
                });
            })
        // Save Deadline
        new Setting(deadlineItems)
            .addButton(button => {
                button.setButtonText("Save Deadline")
                    .setCta()
                    .onClick(async () => {
                        const title = this.plugin.settings.deadlineTitle.trim();
                        const dateTime = this.plugin.settings.deadlineDateTime;
                        const recurrence = this.plugin.settings.selectedRecurrenceValue || 0;
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
                            recurrence
                        });
                        // Reset deadling settings
                        this.plugin.settings.deadlineTitle = '';
                        this.plugin.settings.deadlineDateTime = new Date().toISOString().slice(0, 16);
                        this.plugin.settings.selectedCategory = DEFAULT_CATEGORY;
                        this.plugin.settings.selectedRecurrence = null;
                        categoryInput = '';
                        textComponent.setValue('');
                        await this.plugin.saveSettings();
                        this.display();
                        new Notice("Deadline saved successfully!");
                    });
            });
        // Deadline Management section
        const managesDeadline = containerEl.createEl('div', { cls: 'setting-group' });
        managesDeadline
            .createEl('div', { cls: 'setting-item setting-item-heading' })
            .createEl('div', { text: 'Deadline Management', cls: 'setting-item-name' });
        const manageDeadlineItems = managesDeadline.createEl('div', { cls: 'setting-items' });
        let draggedItem: HTMLElement | null = null;
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
            // Dragging behaviour
            deadlinesContainer.addEventListener('dragover', e => {
                e.preventDefault();
                deadlinesContainer.classList.add('drop-target');
            });
            deadlinesContainer.addEventListener('dragleave', () => {
                deadlinesContainer.classList.remove('drop-target');
            });
            deadlinesContainer.addEventListener('drop', async e => {
                e.preventDefault();
                deadlinesContainer.classList.remove('drop-target');
                if (!draggedItem) {
                    return;
                }
                const draggedDeadline = (draggedItem as any)._deadlineRef as Deadline;
                draggedDeadline.category = category;
                // Remove the deadline from its previous position
                const globalIdx = this.plugin.settings.deadlines!.indexOf(draggedDeadline);
                if (globalIdx > -1) this.plugin.settings.deadlines!.splice(globalIdx, 1);
                // Insert the deadline into the empty category
                this.plugin.settings.deadlines!.push(draggedDeadline);
                await this.plugin.saveSettings();
                this.display();
            });
            // REMINDER: Update this view in the settings tab to be more elaborate after adding the edit function
            // Currently, this is identical to the sidebar view
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
                // Remaining Time
                const remainingTimeEl = cardContainer.createEl('div', { cls: 'grotto-deadline-remaining' });
                const remainingLabelEl = remainingTimeEl.createEl('span');
                const remainingValueEl = remainingTimeEl.createEl('span', { cls: 'grotto-deadline-time-value' });
                const updateRemainingTime = () => {
                    const now = new Date();
                    const deadlineDate = new Date(dl.dateTime);
                    const diff = deadlineDate.getTime() - now.getTime();
                    remainingLabelEl.setText('');
                    remainingValueEl.setText('');
                    remainingLabelEl.removeClass('grotto-deadline-ends');
                    remainingLabelEl.removeClass('grotto-deadline-resets');
                    remainingLabelEl.removeClass('grotto-deadline-passed');
                    if (diff <= 0) {
                        if (dl.recurrence && dl.recurrence > 0) {
                            const next = new Date(deadlineDate);
                            next.setDate(next.getDate() + dl.recurrence);
                            dl.dateTime = next.toISOString();
                            remainingLabelEl.setText('Resets in');
                            remainingLabelEl.addClass('grotto-deadline-resets');
                            remainingValueEl.setText(': ' + formatTime(next));
                        } else {
                            remainingLabelEl.setText('Deadline Passed');
                            remainingLabelEl.addClass('grotto-deadline-passed');
                        }
                    } else {
                        if (dl.recurrence && dl.recurrence > 0) {
                            remainingLabelEl.setText('Resets in');
                            remainingLabelEl.addClass('grotto-deadline-resets');
                            remainingValueEl.setText(': ' + formatTime(deadlineDate));
                        } else {
                            remainingLabelEl.setText('Ends in');
                            remainingLabelEl.addClass('grotto-deadline-ends');
                            remainingValueEl.setText(': ' + formatTime(deadlineDate));
                        }
                    }
                    this.plugin.saveSettings();
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
                setInterval(updateRemainingTime, 1000);
                const actionsContainer = dlEl.createEl('div', { cls: 'grotto-deadline-actions' });
                // Move Up Icon
                const moveUpIcon = actionsContainer.createEl('span', { cls: 'clickable-icon' });
                moveUpIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
                moveUpIcon.onclick = async () => {
                    const categoryItems = this.plugin.settings.deadlines!.filter(d => d.category === category);
                    const idx = categoryItems.indexOf(dl);
                    if (idx > 0) {
                        const globalIdx = this.plugin.settings.deadlines!.indexOf(dl);
                        const prevItem = categoryItems[idx - 1];
                        const prevGlobalIdx = this.plugin.settings.deadlines!.indexOf(prevItem);
                        [this.plugin.settings.deadlines![globalIdx], this.plugin.settings.deadlines![prevGlobalIdx]] =
                            [this.plugin.settings.deadlines![prevGlobalIdx], this.plugin.settings.deadlines![globalIdx]];
                        await this.plugin.saveSettings();
                        this.display();
                    }
                };
                // Move Down Icon
                const moveDownIcon = actionsContainer.createEl('span', { cls: 'clickable-icon' });
                moveDownIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`;
                moveDownIcon.onclick = async () => {
                    const categoryItems = this.plugin.settings.deadlines!.filter(d => d.category === category);
                    const idx = categoryItems.indexOf(dl);
                    if (idx < categoryItems.length - 1) {
                        const globalIdx = this.plugin.settings.deadlines!.indexOf(dl);
                        const nextItem = categoryItems[idx + 1];
                        const nextGlobalIdx = this.plugin.settings.deadlines!.indexOf(nextItem);
                        [this.plugin.settings.deadlines![globalIdx], this.plugin.settings.deadlines![nextGlobalIdx]] =
                            [this.plugin.settings.deadlines![nextGlobalIdx], this.plugin.settings.deadlines![globalIdx]];
                        await this.plugin.saveSettings();
                        this.display();
                    }
                };
                // Delete Icon
                const deleteIcon = actionsContainer.createEl('span', { cls: 'clickable-icon' });
                deleteIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M6 18L18 6M6 6l12 12"/></svg>`;
                deleteIcon.onclick = async () => {
                    const idx = this.plugin.settings.deadlines!.indexOf(dl);
                    if (idx > -1) this.plugin.settings.deadlines!.splice(idx, 1);
                    await this.plugin.saveSettings();
                    this.display();
                    new Notice('Deadline removed');
                };
            });
            // Delete button for empty categories
            // REMINDER: Maybe switch this to a clickable icon instead of a chonky button
            if (categoryDeadlines.length === 0 && category !== DEFAULT_CATEGORY) {
                const deleteCategoryBtn = deadlinesContainer.createEl('button', { text: 'Delete Category', cls: 'grotto-delete-category-btn' });
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
