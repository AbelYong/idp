
export class UserRegisteredMsg {
    constructor(
        private readonly email: string,
        private readonly name: string,
        private readonly parentalSurname: string,
        private readonly maternalSurname: string,
        private readonly userId: string
    ) {
        this.email = email;
        this.name = name;
        this.parentalSurname = parentalSurname;
        this.maternalSurname = maternalSurname;
        this.userId = userId
    }
}
