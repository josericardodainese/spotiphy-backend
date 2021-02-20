export class StringUtils {
    generateRandomString(length: number) {
        let randomStringFinal = '';
        const caractersRule = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (var i = 0; i < length; i++) {
            randomStringFinal += caractersRule.charAt(Math.floor(Math.random() * caractersRule.length));
        }
        return randomStringFinal;
    }
}

export default StringUtils;