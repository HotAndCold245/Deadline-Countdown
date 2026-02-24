# Introduction

Tell me. Do you fear deadlines? 

This plugin allows the user to set and manage deadlines with a convenient way to watch time fly away from the sidebar. 

# User Manual
1. Set a title for the deadline.
2. Set a date and time for the deadline.
3. Select whether the deadline will repeat itself after the time is up.
4. Select the interval of recurrence using the slider. It ranges between 1 and 30 days. This slider will not be visible if recurrence is toggled off. 
5. Set a category for the deadline. This step is optional. Any deadline that does not have a category will move to the default 'General' category. Currently, there is no way to get suggestions to help auto-pick from existing categories. Specific categories will have to be properly typed out. I will improve this later.
6. Save the deadline using the button. 

![Settings1](https://github.com/user-attachments/assets/42968dc8-f7de-4ca1-a6d1-83d33e22167a)

Deadlines will appear in this section in the settings menu. They can be deleted and moved around, BUT, the position can only be adjusted within the same category for now. I will improve this later.

![Settings2](https://github.com/user-attachments/assets/5b0bb8b4-560d-499b-9675-b63c78491316)

# SideBar View
The deadlines can be viewed from the sidebar. There is a button at the top to refresh the timer on the deadlines. I made it manual to avoid potential visual flickers from constantly auto-refreshing the entire viewport. The deadlines are arranged exactly as they appear in the management section of the settings menu. 

If a deadline repeats, the interval for repeating will be displayed. Once the deadline is reached, the date of the deadline will update to the next possible time and will start counting down again. If a deadline does not repeat, when the time is over, the message "Deadline passed" will display in place of the timer. 

When a deadline is approaching, as in, when it is within 1 hour of ending or resetting, it will appear inside a red box as a warning. Currently, there is no way to adjust when this warning begins. I will improve this later.

![Sidebar1](https://github.com/user-attachments/assets/82ad74a6-e8d1-4748-9d57-b957be84d40c)

# Command Palette
There is a command to open the sidebar view. It is only available if the sidebar view has been closed. 

![Sidebar2](https://github.com/user-attachments/assets/da30f0c0-e6d0-4f86-a0dd-12634a67dc3e)

# Mobile Support

![Mobile1](https://github.com/user-attachments/assets/1383e233-9e4e-4a33-8266-959d533f0262)

# Feedback
If there are any problems with the plugin, you can submit an issue on the repository. 
