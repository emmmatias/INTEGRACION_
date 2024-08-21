var isPalindrome = function(x) {
    console.log(x.toString());

    // Handle negative numbers
    if(x < 0) {
        return false;
    }

    // Convert the number to a string, split it into an array, and sort the array in descending order
    let reverse = x.toString().split('').sort((a, b) => {
        return parseInt(b) - parseInt(a);
    }).join('');

    console.log(reverse);

    // Check if the original number is equal to the reversed number
    if(x.toString() === reverse) {
        return true;
    } else {
        return false;
    }
};

console.log(isPalindrome(123)); // Output: false